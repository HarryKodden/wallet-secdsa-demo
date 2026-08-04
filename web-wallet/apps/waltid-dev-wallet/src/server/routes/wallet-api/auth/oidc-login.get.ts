import {getOidcConfig} from "../../../utils/oidcConfig";

/**
 * Start SURF / OIDC login — mirrors classic wallet-api `GET /wallet-api/auth/oidc-login`.
 * Browser is redirected to the IdP; callback lands on `/wallet-api/auth/oidc-session`.
 */
export default defineEventHandler((event) => {
    const oidc = getOidcConfig();
    const query = getQuery(event);
    const redirect =
        typeof query.redirect === "string" && query.redirect.startsWith("/")
            ? query.redirect
            : "/";

    const state = crypto.randomUUID();

    setCookie(event, "oidc.state", state, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
        maxAge: 60 * 10,
    });
    setCookie(event, "oidc.redirect", redirect, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
        maxAge: 60 * 10,
    });

    const url = new URL(oidc.authorizeUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", oidc.clientId);
    url.searchParams.set("redirect_uri", oidc.redirectUri);
    url.searchParams.set("scope", oidc.scopes);
    url.searchParams.set("state", state);

    return sendRedirect(event, url.toString(), 302);
});
