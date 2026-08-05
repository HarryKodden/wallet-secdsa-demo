import {createError, navigateTo, useLazyAsyncData, useRuntimeConfig} from "nuxt/app";
import {useCurrentWallet} from "./accountWallet.ts";
import {decodeRequest} from "./siop-requests.ts";
import {type Ref, ref, watch} from "vue";
import {groupBy} from "./groupings.ts";
import {useSecdsaPin} from "./secdsaPin.ts";
import {
    resolveOid4vciClientConfig,
    startAuthCodeRedirect,
} from "./oid4vciAuthCode.ts";

type WalletDidEntry = { did: string; document?: unknown; default?: boolean; alias?: string };

export type IssuanceGrantType = "pre-authorized_code" | "authorization_code" | "unknown";

/**
 * OID4VCI 1.0 receive flow against wallet-api2.
 * Branches on grant type from resolve-offer:
 * - pre-authorized_code → one-shot POST …/credentials/receive
 * - authorization_code → authorization-url + browser redirect (callback completes)
 */
export async function useIssuance(query: any) {
    const currentWallet = useCurrentWallet();
    const runtimeConfig = useRuntimeConfig();
    const {clientId: oid4vciClientId, redirectUri: oid4vciRedirectUri} =
        resolveOid4vciClientConfig(runtimeConfig);

    const {data: dids, pending: pendingDids} = await useLazyAsyncData<WalletDidEntry[]>(
        async () => {
            const entries = await $fetch<WalletDidEntry[]>(
                `/wallet-api/wallet/${currentWallet.value}/dids`,
            );
            return (entries ?? []).map((e, i) => ({...e, default: i === 0}));
        },
    );
    const selectedDid: Ref<WalletDidEntry | null> = ref(null);

    watch(dids, async (newDids) => {
        await nextTick();
        selectedDid.value = newDids?.find((item) => item.default) ?? newDids?.[0] ?? null;
    });

    const request = decodeRequest(query.request as string);
    const failed = ref(false);
    const failMessage = ref("Unknown error occurred.");
    const grantType = ref<IssuanceGrantType>("unknown");
    const txCodeRequired = ref(false);
    const credentialEndpoint = ref<string>("");
    const nonceEndpoint = ref<string | null>(null);

    let issuerHost: String = "issuer";
    let credentialTypes: String[] = ["Credential"];
    let credentialCount = 1;
    let groupedCredentialTypes: Record<string, { id: number; name: String }[]> = {
        Credential: [{id: 1, name: "Credential"}],
    };

    try {
        const resolved = await $fetch<{
            credentialIssuer?: string;
            credentialConfigurationIds?: string[];
            offeredCredentials?: string[];
            grantType?: string | null;
            txCodeRequired?: boolean;
            credentialEndpoint?: string;
            nonceEndpoint?: string | null;
        }>(`/wallet-api/wallet/${currentWallet.value}/credentials/receive/resolve-offer`, {
            method: "POST",
            body: {offerUrl: request},
        });

        const issuer = resolved.credentialIssuer ?? "unknown";
        try {
            issuerHost = new URL(issuer).host;
        } catch {
            issuerHost = issuer;
        }

        if (resolved.grantType === "authorization_code") {
            grantType.value = "authorization_code";
        } else if (resolved.grantType === "pre-authorized_code") {
            grantType.value = "pre-authorized_code";
        } else {
            grantType.value = "unknown";
        }
        txCodeRequired.value = Boolean(resolved.txCodeRequired);
        credentialEndpoint.value = resolved.credentialEndpoint
            ? String(resolved.credentialEndpoint)
            : "";
        nonceEndpoint.value = resolved.nonceEndpoint
            ? String(resolved.nonceEndpoint)
            : null;

        const ids =
            resolved.credentialConfigurationIds?.length
                ? resolved.credentialConfigurationIds
                : (resolved.offeredCredentials ?? []);
        if (ids.length > 0) {
            credentialTypes = ids;
            credentialCount = ids.length;
            let i = 0;
            groupedCredentialTypes = groupBy(
                ids.map((name) => ({id: ++i, name})),
                (c: { name: string }) => c.name,
            );
        }
    } catch (e: any) {
        console.warn("resolve-offer preview failed, continuing with raw offer", e);
        issuerHost = "issuer";
        credentialTypes = ["OpenID4VCI credential offer"];
        credentialCount = 1;
        groupedCredentialTypes = groupBy(
            [{id: 1, name: "OpenID4VCI credential offer"}],
            (c: { name: string }) => c.name,
        );
    }

    function formatReceiveError(e: any): string {
        let errorMessage =
            typeof e?.data === "string" && e.data.startsWith("{")
                ? JSON.parse(e.data)
                : (e.data ?? e);
        errorMessage = errorMessage?.message ?? errorMessage?.statusMessage ?? errorMessage;
        const text = String(errorMessage);
        if (/invalid_request/i.test(text)) {
            return (
                `${text} — often a stale SECDSA key/DID (SoftHSM was re-keyed). ` +
                `Delete this wallet's SECDSA key + did:jwk, regenerate, create a new DID, then use a fresh offer.`
            );
        }
        if (/redirect_uri|invalid_client|unauthorized_client/i.test(text)) {
            return (
                `${text} — check OID4VCI_CLIENT_ID / OID4VCI_REDIRECT_URI are registered at the issuer AS ` +
                `(default redirect: ${oid4vciRedirectUri}).`
            );
        }
        return text;
    }

    async function acceptCredential() {
        failed.value = false;
        failMessage.value = "";

        const did: string | null =
            selectedDid.value?.did ?? dids.value?.[0]?.did ?? null;

        if (!request) {
            failed.value = true;
            failMessage.value = "Missing credential offer URL.";
            return;
        }

        try {
            if (grantType.value === "authorization_code") {
                if (!credentialEndpoint.value) {
                    // Re-resolve to obtain credential endpoint for the continuation.
                    const resolved = await $fetch<{
                        credentialEndpoint?: string;
                        nonceEndpoint?: string | null;
                    }>(`/wallet-api/wallet/${currentWallet.value}/credentials/receive/resolve-offer`, {
                        method: "POST",
                        body: {offerUrl: request},
                    });
                    credentialEndpoint.value = resolved.credentialEndpoint
                        ? String(resolved.credentialEndpoint)
                        : "";
                    nonceEndpoint.value = resolved.nonceEndpoint
                        ? String(resolved.nonceEndpoint)
                        : null;
                }
                if (!credentialEndpoint.value) {
                    throw new Error(
                        "Could not resolve credential_endpoint for authorization_code offer.",
                    );
                }

                await startAuthCodeRedirect({
                    walletId: String(currentWallet.value),
                    offerUrl: request,
                    did,
                    clientId: oid4vciClientId,
                    redirectUri: oid4vciRedirectUri,
                    credentialEndpoint: credentialEndpoint.value,
                    nonceEndpoint: nonceEndpoint.value,
                });
                return;
            }

            if (grantType.value === "unknown") {
                // Prefer pre-auth one-shot; API will error clearly if offer is auth-code-only.
                console.warn(
                    "resolve-offer did not report grantType; attempting pre-authorized receive",
                );
            }

            const {ensureUnlocked} = useSecdsaPin();
            const unlocked = await ensureUnlocked({
                title: "Enter SECDSA PIN to receive credential",
            });
            if (!unlocked) return;

            await $fetch(`/wallet-api/wallet/${currentWallet.value}/credentials/receive`, {
                method: "POST",
                body: {
                    offerUrl: request,
                    ...(did ? {did} : {}),
                },
            });
            navigateTo(`/wallet/${currentWallet.value}`);
        } catch (e: any) {
            failed.value = true;
            failMessage.value = formatReceiveError(e);
            console.log("Error: ", e?.data ?? e);
        }
    }

    if (!request) {
        throw createError({
            statusCode: 400,
            statusMessage: "Invalid issuance request: No credential_offer",
        });
    }

    return {
        currentWallet,
        dids,
        selectedDid,
        pendingDids,
        acceptCredential,
        failed,
        failMessage,
        credentialTypes,
        credentialCount,
        groupedCredentialTypes,
        issuerHost,
        grantType,
        txCodeRequired,
        oid4vciRedirectUri,
    };
}
