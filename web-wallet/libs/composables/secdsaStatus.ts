import {getCachedWscaStatus, setCachedWscaStatus} from "./localSecretsStore";
import {useUserStore} from "@waltid-web-wallet/stores/user";

export type SecdsaKeyValidity = {
    keyId: string;
    valid: boolean | null;
    reason: string;
};

export type SecdsaDidValidity = {
    did: string;
    valid: boolean | null;
    reason: string;
};

export type SecdsaStatusResponse = {
    reachable: boolean;
    accountId: string;
    activated?: boolean;
    hasUserKey?: boolean;
    /** wallet-api2 process already holds SoftHSM PIN for this account. */
    pinSessionActive?: boolean;
    backend?: string | null;
    wscaPublicKeyHex?: string | null;
    keys?: SecdsaKeyValidity[];
    dids?: SecdsaDidValidity[];
    error?: string | null;
};

/** SoftHSM status changes rarely within a page session — short IndexedDB TTL. */
const STATUS_CACHE_TTL_MS = 45_000;

/**
 * Fetch SoftHSM / SECDSA status for a wallet.
 * Uses [localSecretsStore] when a walt.id account id is available (PRF-encrypted
 * when a passkey PRF key is in session; plain IndexedDB otherwise).
 */
export async function fetchSecdsaStatus(
    walletId: string,
    accountId?: string,
    options?: {force?: boolean},
): Promise<SecdsaStatusResponse | null> {
    if (!walletId) return null;

    const waltAccountId = useUserStore().user?.id?.trim() || "";
    const cacheName = accountId
        ? `${walletId}:${accountId}`
        : walletId;

    if (!options?.force && waltAccountId) {
        try {
            const cached = await getCachedWscaStatus(waltAccountId, cacheName);
            if (
                cached?.status &&
                typeof cached.cachedAt === "number" &&
                Date.now() - cached.cachedAt < STATUS_CACHE_TTL_MS
            ) {
                return cached.status as SecdsaStatusResponse;
            }
        } catch (e) {
            console.warn("[secdsaStatus] cache read failed", e);
        }
    }

    const qs = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
    try {
        const status = await $fetch<SecdsaStatusResponse>(
            `/wallet-api/wallet/${walletId}/keys/secdsa/status${qs}`,
        );
        if (waltAccountId && status) {
            void setCachedWscaStatus(waltAccountId, cacheName, status).catch((e) =>
                console.warn("[secdsaStatus] cache write failed", e),
            );
        }
        return status;
    } catch (e) {
        console.warn("SECDSA status check failed", e);
        return null;
    }
}

export function validityBadgeClass(valid: boolean | null | undefined): string {
    if (valid === true) return "bg-emerald-100 text-emerald-900";
    if (valid === false) return "bg-red-100 text-red-900";
    return "bg-gray-100 text-gray-700";
}

export function validityLabel(valid: boolean | null | undefined): string {
    if (valid === true) return "WSCA OK";
    if (valid === false) return "WSCA stale";
    return "n/a";
}
