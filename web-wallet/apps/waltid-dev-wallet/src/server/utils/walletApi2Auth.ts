import {createHmac} from "node:crypto";
import {decodeJwt} from "jose";

export function walletApi2Base(): string {
    const config = useRuntimeConfig();
    return String(
        config.walletApi2Proxy || process.env.WALLET_API2_PROXY || "http://127.0.0.1:7006",
    ).replace(/\/$/, "");
}

export type WalletApi2LoginResult = {
    token: string;
    sessionId?: string;
    expiration?: string;
};

export type WalletApi2Account = {
    accountId: string;
    email: string;
    walletIds: string[];
};

function oidcBridgeSecret(): string {
    return (
        process.env.OIDC_BRIDGE_SECRET ||
        process.env.NUXT_OIDC_BRIDGE_SECRET ||
        "wallet-secdsa-demo-oidc-bridge-dev-only"
    );
}

/** Stable password for JIT OIDC → wallet-api2 email/password accounts. */
export function oidcBridgePassword(sub: string): string {
    return createHmac("sha256", oidcBridgeSecret()).update(`oidc:${sub}`).digest("base64url");
}

export function oidcAccountEmail(claims: Record<string, unknown>): {email: string; sub: string} {
    const sub = typeof claims.sub === "string" && claims.sub ? claims.sub : "";
    if (!sub) {
        throw createError({statusCode: 401, statusMessage: "OIDC token missing sub"});
    }
    const emailClaim = typeof claims.email === "string" ? claims.email.trim() : "";
    const email =
        emailClaim ||
        `oidc+${sub.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64)}@oidc.secdsa-demo.local`;
    return {email, sub};
}

async function readErrorDetail(res: Response): Promise<string> {
    try {
        return (await res.text()) || res.statusText;
    } catch {
        return res.statusText;
    }
}

export async function walletApi2Register(email: string, password: string): Promise<{accountId: string} | {exists: true}> {
    const res = await fetch(`${walletApi2Base()}/auth/register`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({email, password}),
    });
    if (res.status === 409) {
        return {exists: true};
    }
    if (!res.ok) {
        throw createError({
            statusCode: res.status,
            statusMessage: `wallet-api2 register failed: ${await readErrorDetail(res)}`,
        });
    }
    const json = (await res.json()) as {accountId?: string};
    if (!json.accountId) {
        throw createError({statusCode: 502, statusMessage: "wallet-api2 register missing accountId"});
    }
    return {accountId: json.accountId};
}

export async function walletApi2EmailPass(email: string, password: string): Promise<WalletApi2LoginResult> {
    const res = await fetch(`${walletApi2Base()}/auth/emailpass`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({email, password}),
    });
    if (!res.ok) {
        throw createError({
            statusCode: res.status === 401 || res.status === 403 ? 401 : res.status,
            statusMessage: `Login failed: ${await readErrorDetail(res)}`,
        });
    }
    const json = (await res.json()) as Record<string, unknown>;
    const token = typeof json.token === "string" ? json.token : "";
    if (!token) {
        throw createError({statusCode: 502, statusMessage: "wallet-api2 login missing token"});
    }
    return {
        token,
        sessionId: typeof json.session_id === "string" ? json.session_id : undefined,
        expiration: typeof json.expiration === "string" ? json.expiration : undefined,
    };
}

export async function walletApi2Account(token: string): Promise<WalletApi2Account> {
    const res = await fetch(`${walletApi2Base()}/auth/account`, {
        headers: {Authorization: `Bearer ${token}`},
    });
    if (!res.ok) {
        throw createError({
            statusCode: res.status === 401 ? 401 : res.status,
            statusMessage: `Not authenticated: ${await readErrorDetail(res)}`,
        });
    }
    const json = (await res.json()) as WalletApi2Account;
    return {
        accountId: json.accountId,
        email: json.email || "",
        walletIds: Array.isArray(json.walletIds) ? json.walletIds : [],
    };
}

export async function walletApi2Logout(token: string | undefined): Promise<void> {
    if (!token) return;
    try {
        await fetch(`${walletApi2Base()}/auth/logout`, {
            method: "POST",
            headers: {Authorization: `Bearer ${token}`},
        });
    } catch {
        // Best-effort; cookie clear still logs the browser out.
    }
}

/**
 * Exchange a SURF OIDC JWT for a wallet-api2 session (JIT register + emailpass).
 * wallet-api2 does not accept external IdP JWTs as Bearer tokens.
 */
export async function bridgeOidcToWalletApi2(oidcJwt: string): Promise<{
    token: string;
    email: string;
    accountId: string;
}> {
    let claims: Record<string, unknown>;
    try {
        claims = decodeJwt(oidcJwt) as Record<string, unknown>;
    } catch {
        throw createError({statusCode: 401, statusMessage: "Invalid OIDC token"});
    }

    const {email, sub} = oidcAccountEmail(claims);
    const password = oidcBridgePassword(sub);

    await walletApi2Register(email, password);
    const login = await walletApi2EmailPass(email, password);
    const account = await walletApi2Account(login.token);

    return {token: login.token, email: account.email || email, accountId: account.accountId};
}
