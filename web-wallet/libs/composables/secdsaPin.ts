import {markRaw, watch} from "vue";
import SecdsaPinModal from "../components/modals/SecdsaPinModal.vue";
import useModalStore from "../stores/useModalStore.ts";
import {useCurrentWallet} from "./accountWallet.ts";
import {createNewWallet} from "./accountWallet.ts";
import {useRuntimeConfig} from "nuxt/app";
import {useUserStore} from "../stores/user.ts";
import {fetchSecdsaStatus} from "./secdsaStatus.ts";
import {useSecurityStore} from "../stores/security.ts";
import {encryptPin} from "./webauthnPrf.ts";

/**
 * SECDSA SoftHSM PIN helpers for the educational web-wallet clone.
 *
 * PIN security tiers (best → fallback):
 *   1. PRF-decrypted from server blob (loaded on login, silent — no modal)
 *   2. User entry via modal (validated inline; result encrypted + persisted if PRF key available)
 *
 * OIDC users: WSCA account id = OIDC `sub` (session.wscaAccountId / auth.wsca cookie).
 */

export function useSecdsaPin() {
    const currentWallet = useCurrentWallet();
    const config = useRuntimeConfig();
    const userStore = useUserStore();

    function defaultAccountId(): string {
        const fromUser = (userStore.user as {wscaAccountId?: string} | undefined)?.wscaAccountId;
        if (fromUser && fromUser.trim()) return fromUser.trim();
        console.warn("[secdsaPin] No WSCA account ID available — user must sign in with OIDC first.");
        return "";
    }

    function defaultBaseUrl(): string {
        return (config.public.wscaBaseUrl as string | undefined) || "http://host.docker.internal:18080";
    }

    async function resolveWalletId(walletId?: string | null): Promise<string> {
        const id = walletId ?? currentWallet.value;
        if (id) return id;
        return createNewWallet(false);
    }

    /**
     * Validates the PIN via the Nitro unlock route (SoftHSM Protocol 4 / instruct).
     * On success: stores the PIN in Pinia and, if a PRF key is available,
     * encrypts it and persists the ciphertext to the server.
     *
     * @param mode  "setup" = SoftHSM not activated yet (first PIN locks the account)
     *              "unlock" = SoftHSM already activated (PIN must match; never choose a new one)
     */
    async function unlockWithPin(
        pin: string,
        accountId: string = defaultAccountId(),
        walletId?: string | null,
        mode: "setup" | "unlock" = "unlock",
    ): Promise<void> {
        const id = await resolveWalletId(walletId);
        await $fetch(`/wallet-api/wallet/${id}/keys/secdsa/unlock`, {
            method: "POST",
            body: {accountId, pin, mode},
        });

        // PIN is now validated — cache it in memory for this session.
        const securityStore = useSecurityStore();
        securityStore.setSecdsaPin(pin, accountId);

        // If a PRF key is available, encrypt the PIN and persist the blob so
        // future logins can skip the modal entirely (tier-1 path).
        if (securityStore.prfKey) {
            try {
                const blob = await encryptPin(securityStore.prfKey, pin);
                await $fetch("/wallet-api/auth/webauthn/wsca-pin", {
                    method: "POST",
                    body: {accountId, blob},
                });
            } catch (e) {
                // Non-fatal: PIN is still cached in-memory for this session.
                console.warn("[secdsa] Failed to persist encrypted PIN:", e);
            }
        }
    }

    /**
     * Prompt the user for a PIN (modal).
     * When `walletId` is provided the modal validates the PIN inline against
     * the SECDSA service before resolving — wrong PINs show an error and the
     * modal stays open for retry.
     * Returns null if the user cancels.
     */
    function promptPin(
        title = "Enter SECDSA PIN",
        options?: {mode?: "unlock" | "setup"; accountId?: string; walletId?: string | null},
    ): Promise<string | null> {
        return new Promise((resolve) => {
            const modalStore = useModalStore();
            let settled = false;
            const settle = (value: string | null) => {
                if (settled) return;
                settled = true;
                stopWatch();
                if (modalStore.modalState.component) {
                    modalStore.closeModal();
                }
                resolve(value);
            };

            const walletId = options?.walletId;
            const accountId = options?.accountId ?? defaultAccountId();

            modalStore.openModal({
                component: markRaw(SecdsaPinModal),
                props: {
                    title,
                    mode: options?.mode ?? "unlock",
                    accountHint: accountId,
                    // Inline validation + persistence when walletId is known.
                    unlock: walletId
                        ? (pin: string) => unlockWithPin(pin, accountId, walletId)
                        : undefined,
                    onSubmit: (pin: string) => settle(pin),
                    onCancel: () => settle(null),
                },
            });

            const stopWatch = watch(
                () => modalStore.modalState.component,
                (component) => {
                    if (!component) settle(null);
                },
            );
        });
    }

    /**
     * Ensures the WSCA slot is unlocked before a SECDSA operation.
     *
     * Tier 1 — silent: if the PIN is already in Pinia (loaded from PRF on
     *   login, or carried from a previous unlock this session), use it
     *   directly without showing any modal.
     * Tier 2 — modal: prompt the user; on success the PIN is cached + persisted.
     *
     * Returns false only if the user cancels the modal.
     */
    async function ensureUnlocked(options?: {
        accountId?: string;
        title?: string;
        mode?: "unlock" | "setup";
        /** Required on pages without `/wallet/:wallet` (e.g. OID4VCI callback). */
        walletId?: string | null;
    }): Promise<boolean> {
        const accountId = options?.accountId ?? defaultAccountId();
        const id = await resolveWalletId(options?.walletId);
        const securityStore = useSecurityStore();

        // --- Tier 0: wallet-api2 already holds the PIN (process-memory session) ---
        // Survives SPA navigations and full page reloads while wallet-api2 is up.
        if (accountId && (options?.mode ?? "unlock") === "unlock") {
            const status = await fetchSecdsaStatus(id, accountId);
            if (status?.pinSessionActive === true) {
                return true;
            }
        }

        // --- Tier 1: browser-session PIN (Pinia) — refill wallet-api2 if needed ---
        const cachedPin = securityStore.secdsaPin;
        if (cachedPin && securityStore.secdsaPinAccountId === accountId) {
            try {
                // Validate the cached PIN (also repopulates wallet-api2 SecdsaPinSession).
                await $fetch(`/wallet-api/wallet/${id}/keys/secdsa/unlock`, {
                    method: "POST",
                    body: {accountId, pin: cachedPin, mode: "unlock"},
                });
                return true;
            } catch (e: unknown) {
                const statusCode =
                    e && typeof e === "object" && "statusCode" in e
                        ? Number((e as {statusCode?: number}).statusCode)
                        : e && typeof e === "object" && "status" in e
                          ? Number((e as {status?: number}).status)
                          : undefined;
                // Only drop the cache on an explicit wrong-PIN / auth rejection.
                if (statusCode === 401) {
                    securityStore.setSecdsaPin(null, accountId);
                } else {
                    console.warn("[secdsa] Cached PIN re-unlock failed; keeping cache:", e);
                }
            }
        }

        // --- Tier 2: modal ---
        const mode = options?.mode ?? "unlock";
        const title =
            options?.title ??
            (mode === "setup" ? "Set your SECDSA PIN to continue" : "Enter SECDSA PIN to continue");

        return new Promise((resolve) => {
            const modalStore = useModalStore();
            let settled = false;
            const settle = (ok: boolean) => {
                if (settled) return;
                settled = true;
                stopWatch();
                if (modalStore.modalState.component) {
                    modalStore.closeModal();
                }
                resolve(ok);
            };

            modalStore.openModal({
                component: markRaw(SecdsaPinModal),
                props: {
                    title,
                    mode,
                    accountHint: accountId,
                    unlock: (pin: string) => unlockWithPin(pin, accountId, options?.walletId, mode),
                    onSubmit: () => settle(true),
                    onCancel: () => settle(false),
                },
            });

            const stopWatch = watch(
                () => modalStore.modalState.component,
                (component) => {
                    if (!component) settle(false);
                },
            );
        });
    }

    function keyIdOf(key: unknown): string {
        if (!key || typeof key !== "object") return "";
        const k = key as {keyId?: string | {id?: string}; id?: string};
        if (typeof k.keyId === "string") return k.keyId;
        if (k.keyId && typeof k.keyId === "object" && typeof k.keyId.id === "string") {
            return k.keyId.id;
        }
        return typeof k.id === "string" ? k.id : "";
    }

    function didIdOf(did: unknown): string {
        if (typeof did === "string") return did;
        if (!did || typeof did !== "object") return "";
        const d = did as {did?: string};
        return typeof d.did === "string" ? d.did : "";
    }

    /**
     * After SoftHSM PIN is available: ensure a SECDSA key + did:jwk exist.
     * Idempotent — skips steps that already succeeded. Failures are logged and
     * do not undo PIN unlock (user can still create manually in Settings).
     */
    async function ensureSecdsaKeyAndDid(
        walletId: string,
        accountId: string,
    ): Promise<void> {
        const securityStore = useSecurityStore();
        const pin = securityStore.secdsaPin;
        if (!pin || securityStore.secdsaPinAccountId !== accountId) {
            console.warn("[secdsa] No session PIN — skip auto key/DID provision");
            return;
        }

        const baseUrl = defaultBaseUrl()
            .replace("://localhost:", "://host.docker.internal:")
            .replace("://127.0.0.1:", "://host.docker.internal:");

        let keys: unknown[] = [];
        try {
            keys = (await $fetch<unknown[]>(`/wallet-api/wallet/${walletId}/keys`)) ?? [];
        } catch (e) {
            console.warn("[secdsa] Could not list keys for auto-provision:", e);
            return;
        }

        let keyId = keys.map(keyIdOf).find((id) => id.startsWith("secdsa:")) ?? "";

        if (!keyId) {
            try {
                const created = await $fetch<{keyId?: string} | string>(
                    `/wallet-api/wallet/${walletId}/keys/generate`,
                    {
                        method: "POST",
                        body: {
                            backend: "secdsa",
                            keyType: "secp256r1",
                            name: "SECDSA",
                            config: {baseUrl, accountId, pin},
                        },
                    },
                );
                keyId =
                    typeof created === "string"
                        ? created
                        : String(created?.keyId || "");
                if (!keyId) {
                    keys =
                        (await $fetch<unknown[]>(`/wallet-api/wallet/${walletId}/keys`)) ??
                        [];
                    keyId = keys.map(keyIdOf).find((id) => id.startsWith("secdsa:")) ?? "";
                }
            } catch (e) {
                console.warn("[secdsa] Auto SECDSA key generate failed:", e);
                return;
            }
        }

        if (!keyId) {
            console.warn("[secdsa] No SECDSA keyId after generate — skip DID");
            return;
        }

        let dids: unknown[] = [];
        try {
            dids = (await $fetch<unknown[]>(`/wallet-api/wallet/${walletId}/dids`)) ?? [];
        } catch (e) {
            console.warn("[secdsa] Could not list DIDs for auto-provision:", e);
            return;
        }

        if (dids.some((d) => didIdOf(d).startsWith("did:jwk:"))) {
            return;
        }

        try {
            await $fetch(`/wallet-api/wallet/${walletId}/dids/create`, {
                method: "POST",
                body: {
                    method: "jwk",
                    keyId,
                },
            });
        } catch (e) {
            console.warn("[secdsa] Auto did:jwk create failed:", e);
        }
    }

    /**
     * After OIDC login:
     * - SoftHSM not activated → setup (choose PIN; Protocol 4 locks it to the account)
     * - SoftHSM activated → unlock with the existing PIN if not already in session
     * - On success → auto-create SECDSA key + did:jwk if missing
     * Returns false only if the user cancels when a PIN is required.
     */
    async function ensureWscaInitialized(options?: {
        accountId?: string;
        walletId?: string | null;
    }): Promise<boolean> {
        const accountId = options?.accountId ?? defaultAccountId();
        const walletId = await resolveWalletId(options?.walletId);
        const status = await fetchSecdsaStatus(walletId, accountId);
        const securityStore = useSecurityStore();

        let unlocked = false;

        // Only first SoftHSM activation may choose a PIN.
        if (status?.activated === false) {
            unlocked = await ensureUnlocked({
                accountId,
                walletId,
                mode: "setup",
                title: "Choose a 6-digit PIN to initialise SECDSA",
            });
        } else if (securityStore.secdsaPin && securityStore.secdsaPinAccountId === accountId) {
            // Activated: reuse cached PIN when present.
            unlocked = await ensureUnlocked({accountId, walletId, mode: "unlock"});
        } else {
            unlocked = await ensureUnlocked({
                accountId,
                walletId,
                mode: "unlock",
                title: "Enter your SECDSA PIN to continue",
            });
        }

        if (unlocked) {
            await ensureSecdsaKeyAndDid(walletId, accountId);
        }
        return unlocked;
    }

    return {
        defaultAccountId,
        defaultBaseUrl,
        promptPin,
        unlockWithPin,
        ensureUnlocked,
        ensureWscaInitialized,
        ensureSecdsaKeyAndDid,
    };
}
