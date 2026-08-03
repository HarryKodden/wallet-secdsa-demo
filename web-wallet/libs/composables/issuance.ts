import {createError, navigateTo, useLazyAsyncData} from "nuxt/app";
import {useCurrentWallet} from "./accountWallet.ts";
import {decodeRequest} from "./siop-requests.ts";
import {type Ref, ref, watch} from "vue";
import {groupBy} from "./groupings.ts";
import {useSecdsaPin} from "./secdsaPin.ts";

type WalletDidEntry = { did: string; document?: unknown; default?: boolean };

/**
 * OID4VCI 1.0 receive flow against wallet-api2.
 */
export async function useIssuance(query: any) {
    const currentWallet = useCurrentWallet();
    const {data: dids, pending: pendingDids} = await useLazyAsyncData<WalletDidEntry[]>(
        async () => {
            const entries = await $fetch<WalletDidEntry[]>(
                `/wallet-api/wallet/${currentWallet.value}/dids`,
            );
            // wallet-api2 has no default flag on list; treat first as selected
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

    let credentialOffer: unknown = null;
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
        // Still allow accept — receive will re-resolve the offer
        console.warn("resolve-offer preview failed, continuing with raw offer", e);
        issuerHost = "issuer";
        credentialTypes = ["OpenID4VCI credential offer"];
        credentialCount = 1;
        groupedCredentialTypes = groupBy(
            [{id: 1, name: "OpenID4VCI credential offer"}],
            (c: { name: string }) => c.name,
        );
    }

    async function acceptCredential() {
        failed.value = false;
        failMessage.value = "";

        const did: string | null =
            selectedDid.value?.did ?? dids.value?.[0]?.did ?? null;

        try {
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

            let errorMessage =
                typeof e?.data === "string" && e.data.startsWith("{")
                    ? JSON.parse(e.data)
                    : (e.data ?? e);
            errorMessage = errorMessage?.message ?? errorMessage;

            failMessage.value = String(errorMessage);
            console.log("Error: ", e?.data);
            // Do not rethrow — caller (ActionButton) must be able to reset and retry
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
    };
}
