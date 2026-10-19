/**
 * Track G2 — clear the client signing window when the tab is hidden or page is unloaded.
 * Server SignGrant TTL still applies independently.
 */
import {useSecurityStore} from "@waltid-web-wallet/stores/security.ts";

export default defineNuxtPlugin(() => {
    if (!import.meta.client) return;

    const onHidden = () => {
        if (document.visibilityState !== "hidden") return;
        try {
            useSecurityStore().clearSigningWindow();
        } catch {
            /* Pinia may not be ready during HMR */
        }
    };

    const onPageHide = () => {
        try {
            useSecurityStore().clearSigningWindow();
        } catch {
            /* ignore */
        }
    };

    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
});
