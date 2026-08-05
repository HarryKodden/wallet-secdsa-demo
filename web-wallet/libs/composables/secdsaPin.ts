import {markRaw, watch} from "vue";
import SecdsaPinModal from "../components/modals/SecdsaPinModal.vue";
import useModalStore from "../stores/useModalStore.ts";
import {useCurrentWallet} from "./accountWallet.ts";
import {useRuntimeConfig} from "nuxt/app";

/**
 * SECDSA SoftHSM PIN helpers for the educational web-wallet clone.
 *
 * The PIN is collected in the UI and sent to the wallet backend unlock endpoint
 * right before GENKEY/SIGN. It is not written into long-lived frontend or server config.
 */

export function useSecdsaPin() {
    const currentWallet = useCurrentWallet();
    const config = useRuntimeConfig();

    function defaultAccountId(): string {
        return (config.public.wscaAccountId as string | undefined) || "citizen-42";
    }

    function defaultBaseUrl(): string {
        return (config.public.wscaBaseUrl as string | undefined) || "http://host.docker.internal:18080";
    }

    /** Prompt the user for a PIN (modal). Returns null if cancelled. */
    function promptPin(title = "Enter SECDSA PIN"): Promise<string | null> {
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
                    onSubmit: (pin: string) => settle(pin),
                    onCancel: () => settle(null),
                },
            });

            // Escape / X on ModalBase closes without calling onCancel — settle as cancel.
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
        const id = walletId ?? currentWallet.value;
        if (!id) {
            throw new Error(
                "No wallet selected — cannot unlock SECDSA (open a wallet page or pass walletId).",
            );
        }
        try {
            await $fetch(`/wallet-api/wallet/${id}/keys/secdsa/unlock`, {
                method: "POST",
                body: {accountId, pin},
            });
        } catch (e: any) {
            // Older wallet-api2 images may not expose unlock yet; GENKEY/SIGN still
            // accept a one-shot `pin` in the request body.
            const status = e?.statusCode ?? e?.status ?? e?.response?.status;
            if (status === 404) {
                console.warn("SECDSA unlock endpoint missing; continuing with one-shot PIN in request");
                return;
            }
            throw e;
        }
    }

    /**
     * Prompt for PIN and unlock SoftHSM. Wrong PIN keeps the modal open for retry.
     * Returns false if the user cancels.
     */
    async function ensureUnlocked(options?: {
        accountId?: string;
        title?: string;
        /** Required on pages without `/wallet/:wallet` (e.g. OID4VCI callback). */
        walletId?: string | null;
    }): Promise<boolean> {
        const accountId = options?.accountId ?? defaultAccountId();
        const title = options?.title ?? "Enter SECDSA PIN to continue";
        const walletId = options?.walletId ?? currentWallet.value;

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
                    unlock: (pin: string) => unlockWithPin(pin, accountId, walletId),
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

    return {
        defaultAccountId,
        defaultBaseUrl,
        promptPin,
        unlockWithPin,
        ensureUnlocked,
    };
}
