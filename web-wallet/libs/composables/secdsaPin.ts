import {markRaw, watch} from "vue";
import SecdsaPinModal from "../components/modals/SecdsaPinModal.vue";
import useModalStore from "../stores/useModalStore.ts";
import {useCurrentWallet} from "./accountWallet.ts";
import {createNewWallet} from "./accountWallet.ts";
import {useRuntimeConfig} from "nuxt/app";
import {useUserStore} from "../stores/user.ts";
import {fetchSecdsaStatus} from "./secdsaStatus.ts";

/**
 * SECDSA SoftHSM PIN helpers for the educational web-wallet clone.
 *
 * OIDC users: WSCA account id = OIDC `sub` (session.wscaAccountId / auth.wsca cookie).
 * Lab email login: falls back to NUXT_PUBLIC_WSCA_ACCOUNT_ID (citizen-42).
 */

export function useSecdsaPin() {
    const currentWallet = useCurrentWallet();
    const config = useRuntimeConfig();
    const userStore = useUserStore();

    function defaultAccountId(): string {
        const fromUser = (userStore.user as {wscaAccountId?: string} | undefined)?.wscaAccountId;
        if (fromUser && fromUser.trim()) return fromUser.trim();
        return (config.public.wscaAccountId as string | undefined) || "citizen-42";
    }

    function defaultBaseUrl(): string {
        return (config.public.wscaBaseUrl as string | undefined) || "http://host.docker.internal:18080";
    }

    async function resolveWalletId(walletId?: string | null): Promise<string> {
        const id = walletId ?? currentWallet.value;
        if (id) return id;
        return createNewWallet(false);
    }

    /** Prompt the user for a PIN (modal). Returns null if cancelled. */
    function promptPin(
        title = "Enter SECDSA PIN",
        options?: {mode?: "unlock" | "setup"; accountId?: string},
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

            modalStore.openModal({
                component: markRaw(SecdsaPinModal),
                props: {
                    title,
                    mode: options?.mode ?? "unlock",
                    accountHint: options?.accountId ?? defaultAccountId(),
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

    async function unlockWithPin(
        pin: string,
        accountId: string = defaultAccountId(),
        walletId?: string | null,
    ): Promise<void> {
        const id = await resolveWalletId(walletId);
        try {
            await $fetch(`/wallet-api/wallet/${id}/keys/secdsa/unlock`, {
                method: "POST",
                body: {accountId, pin},
            });
        } catch (e: any) {
            const status = e?.statusCode ?? e?.status ?? e?.response?.status;
            if (status === 404) {
                console.warn("SECDSA unlock endpoint missing; continuing with one-shot PIN in request");
                return;
            }
            throw e;
        }
    }

    /**
     * Ensures the WSCA slot is unlocked before a SECDSA operation.
     * Shows a PIN modal and returns false only if the user cancels.
     */
    async function ensureUnlocked(options?: {
        accountId?: string;
        title?: string;
        mode?: "unlock" | "setup";
        /** Required on pages without `/wallet/:wallet` (e.g. OID4VCI callback). */
        walletId?: string | null;
    }): Promise<boolean> {
        const accountId = options?.accountId ?? defaultAccountId();
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
                    unlock: (pin: string) => unlockWithPin(pin, accountId, options?.walletId),
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
     * After OIDC login: if the WSCA account for this `sub` is not activated yet,
     * prompt for a 6-digit PIN and run Protocol 4 activate via unlock.
     * Returns false only if the user cancels setup when required.
     */
    async function ensureWscaInitialized(options?: {
        accountId?: string;
        walletId?: string | null;
    }): Promise<boolean> {
        const accountId = options?.accountId ?? defaultAccountId();
        const walletId = await resolveWalletId(options?.walletId);
        const status = await fetchSecdsaStatus(walletId, accountId);

        // Unknown / not activated → first-time PIN setup.
        const needsSetup = !status?.activated;
        if (!needsSetup) {
            return true;
        }

        return ensureUnlocked({
            accountId,
            walletId,
            mode: "setup",
            title: "Choose a 6-digit PIN to initialise SECDSA",
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
