/**
 * Canonical OIDC / OID4VCI env names (no NUXT_ prefix).
 *
 *   OIDC_BASE_URL       — wallet origin (post-login + pairing)
 *   OIDC_AUTHORIZE_URL  — IdP authorize endpoint
 *   OIDC_TOKEN_URL      — IdP token endpoint
 *   OIDC_REDIRECT_URI   — IdP redirect_uri (…/wallet-api/auth/oidc-session)
 *   OIDC_SCOPES         — space-separated scopes
 *   OIDC_CLIENT_ID / OIDC_CLIENT_SECRET
 *   OID4VCI_CLIENT_ID / OID4VCI_REDIRECT_URI (optional; redirect defaults from base URL)
 */

function firstEnv(...names: string[]): string {
    for (const name of names) {
        const v = process.env[name]?.trim();
        if (v) return v;
    }
    return "";
}

export type ResolvedOidcEnv = {
    baseUrl: string;
    authorizeUrl: string;
    tokenUrl: string;
    redirectUri: string;
    scopes: string;
    clientId: string;
    clientSecret: string;
    /** OID4VCI callback; defaults to `${baseUrl}/oid4vci/callback`. */
    oid4vciRedirectUri: string;
    oid4vciClientId: string;
};

export function resolveOidcEnv(): ResolvedOidcEnv {
    // Live process env wins over Nuxt-baked runtimeConfig (images often bake localhost).
    // WALLET_PUBLIC_BASE_URL / PUBLIC_BASE_URL are deploy aliases for the same wallet origin.
    const baseUrl =
        firstEnv("OIDC_BASE_URL", "WALLET_PUBLIC_BASE_URL", "PUBLIC_BASE_URL") ||
        "http://localhost:7115";
    const baseTrimmed = baseUrl.replace(/\/$/, "");

    return {
        baseUrl: baseTrimmed,
        authorizeUrl:
            firstEnv("OIDC_AUTHORIZE_URL") || "https://oidc.pilot1.sram.surf.nl/authorize",
        tokenUrl: firstEnv("OIDC_TOKEN_URL") || "https://oidc.pilot1.sram.surf.nl/token",
        redirectUri:
            firstEnv("OIDC_REDIRECT_URI") || `${baseTrimmed}/wallet-api/auth/oidc-session`,
        scopes: firstEnv("OIDC_SCOPES") || "openid email profile",
        clientId: firstEnv("OIDC_CLIENT_ID"),
        clientSecret: firstEnv("OIDC_CLIENT_SECRET"),
        oid4vciClientId: firstEnv("OID4VCI_CLIENT_ID") || "wallet-secdsa-demo",
        oid4vciRedirectUri:
            firstEnv("OID4VCI_REDIRECT_URI") || `${baseTrimmed}/oid4vci/callback`,
    };
}
