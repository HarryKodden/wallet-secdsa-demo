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

        // --- Tier 1: cached PIN ---
        const securityStore = useSecurityStore();
        const cachedPin = securityStore.secdsaPin;
        if (cachedPin && securityStore.secdsaPinAccountId === accountId) {
            try {
                const id = await resolveWalletId(options?.walletId);
                // Validate the cached PIN (also repopulates wallet-api2 SecdsaPinSession).
                await $fetch(`/wallet-api/wallet/${id}/keys/secdsa/unlock`, {
                    method: "POST",
                    body: {accountId, pin: cachedPin, mode: "unlock"},
                });
                return true;
            } catch {
                // Cached PIN rejected — clear it and fall through to modal.
                securityStore.setSecdsaPin(null, accountId);
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

    /**
     * After OIDC login:
     * - SoftHSM not activated → setup (choose PIN; Protocol 4 locks it to the account)
     * - SoftHSM activated → unlock with the existing PIN if not already in session
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

        // Only first SoftHSM activation may choose a PIN.
        if (status?.activated === false) {
            return ensureUnlocked({
                accountId,
                walletId,
                mode: "setup",
                title: "Choose a 6-digit PIN to initialise SECDSA",
            });
        }

        // Activated (or status unknown): PIN is locked — unlock if not already cached.
        if (securityStore.secdsaPin && securityStore.secdsaPinAccountId === accountId) {
            return ensureUnlocked({accountId, walletId, mode: "unlock"});
        }

        return ensureUnlocked({
            accountId,
            walletId,
            mode: "unlock",
            title: "Enter your SECDSA PIN to continue",
        });
    }

    return {
        defaultAccountId,
        defaultBaseUrl,
        promptPin,
        unlockWithPin,
        ensureUnlocked,
        ensureWscaInitialized,
    };
}
