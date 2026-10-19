import {resolveOidcEnv} from "./oidcEnv";

export type OidcRuntimeConfig = {
    authorizeUrl: string;
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string;
    publicBaseUrl: string;
};

export function getOidcConfig(): OidcRuntimeConfig {
    const env = resolveOidcEnv();
    const config = useRuntimeConfig();

    // Prefer live OIDC_* from the process env; fall back to runtimeConfig.
    const authorizeUrl =
        env.authorizeUrl || String(config.public.oidcAuthorizeUrl || "");
    const tokenUrl = env.tokenUrl || String(config.oidcTokenUrl || "");
    const clientId = env.clientId || String(config.public.oidcClientId || "");
    const clientSecret =
        env.clientSecret || String(config.oidcClientSecret || "");
    const redirectUri =
        env.redirectUri ||
        String(config.public.oidcRedirectUri || "") ||
        "http://localhost:7115/wallet-api/auth/oidc-session";
    const scopes =
        env.scopes || String(config.public.oidcScopes || "openid email profile");
    const publicBaseUrl =
        env.baseUrl ||
        String(config.public.oidcPublicBaseUrl || "http://localhost:7115");

    if (!authorizeUrl || !tokenUrl || !clientId) {
        throw createError({
            statusCode: 500,
            statusMessage: "OIDC is not configured (authorize URL, token URL, client id).",
        });
    }

    return {
        authorizeUrl,
        tokenUrl,
        clientId,
        clientSecret,
        redirectUri,
        scopes,
        publicBaseUrl,
    };
}
