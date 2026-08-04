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
    const config = useRuntimeConfig();
    const authorizeUrl = String(config.public.oidcAuthorizeUrl || "");
    const tokenUrl = String(config.oidcTokenUrl || "");
    const clientId = String(config.public.oidcClientId || "");
    const clientSecret = String(config.oidcClientSecret || "");
    const redirectUri = String(
        config.public.oidcRedirectUri || "http://localhost:7115/wallet-api/auth/oidc-session"
    );
    const scopes = String(config.public.oidcScopes || "openid email profile");
    const publicBaseUrl = String(config.public.oidcPublicBaseUrl || "http://localhost:7115");

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
