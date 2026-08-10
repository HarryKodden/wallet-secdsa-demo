import {decodeJwt} from "jose";

export type AuthSession = {
    id: string;
    email: string;
    friendlyName: string;
    oidcSession: boolean;
    token?: string;
    /** WSCA SoftHSM account id — OIDC `sub` when present, else demo default. */
    wscaAccountId?: string;
    walletIds?: string[];
};

function readString(value: unknown, fallback = ""): string {
    return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

/** True when the cookie looks like a wallet-api2 / OIDC JWT (not the old basic: stub). */
export function isJwtToken(token: string): boolean {
    return token.split(".").length === 3 && !token.startsWith("basic:");
}

/**
 * Best-effort decode for display only. Wallet-api2 JWTs carry `sub` = accountId
 * and no email — prefer GET /auth/account for session enrichment.
 */
export function decodeTokenClaims(token: string): Record<string, unknown> | null {
    if (!token || !isJwtToken(token)) {
        return null;
    }
    try {
        return decodeJwt(token) as Record<string, unknown>;
    } catch {
        return null;
    }
}

export function sessionFromAccount(
    token: string,
    account: {accountId: string; email: string; walletIds?: string[]},
    oidcSession: boolean,
    wscaAccountId?: string,
): AuthSession {
    const email = readString(account.email, "n/a");
    return {
        id: account.accountId,
        email,
        friendlyName: email,
        oidcSession,
        token,
        wscaAccountId: wscaAccountId || undefined,
        walletIds: Array.isArray(account.walletIds) ? account.walletIds : undefined,
    };
}
