import {getOidcConfig} from "../../../utils/oidcConfig";
import {generatePkceS256} from "../../../utils/pkce";

/**
 * Start OIDC login — mirrors classic wallet-api `GET /wallet-api/auth/oidc-login`.
 * Browser is redirected to the IdP; callback lands on `/wallet-api/auth/oidc-session`.
 * Always sends PKCE S256 (required by PocketID and most modern IdPs).
 */
export default defineEventHandler((event) => {
    const oidc = getOidcConfig();
    const query = getQuery(event);
    const redirect =
        typeof query.redirect === "string" && query.redirect.startsWith("/")
            ? query.redirect
            : "/";

    const state = crypto.randomUUID();
    const pkce = generatePkceS256();
    const secure = getRequestURL(event).protocol === "https:";

    const cookieOpts = {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure,
        maxAge: 60 * 10,
    };

    setCookie(event, "oidc.state", state, cookieOpts);
    setCookie(event, "oidc.redirect", redirect, cookieOpts);
    setCookie(event, "oidc.pkce", pkce.verifier, cookieOpts);

    const url = new URL(oidc.authorizeUrl);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", oidc.clientId);
    url.searchParams.set("redirect_uri", oidc.redirectUri);
    url.searchParams.set("scope", oidc.scopes);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", pkce.challenge);
    url.searchParams.set("code_challenge_method", pkce.method);

    return sendRedirect(event, url.toString(), 302);
});
