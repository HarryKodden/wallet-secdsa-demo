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

export async function fetchSecdsaStatus(
    walletId: string,
    accountId?: string,
): Promise<SecdsaStatusResponse | null> {
    if (!walletId) return null;
    const qs = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
    try {
        return await $fetch<SecdsaStatusResponse>(
            `/wallet-api/wallet/${walletId}/keys/secdsa/status${qs}`,
        );
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
