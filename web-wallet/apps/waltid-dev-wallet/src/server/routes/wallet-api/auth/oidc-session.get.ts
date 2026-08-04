import {getOidcConfig} from "../../../utils/oidcConfig";

/**
 * OIDC callback — mirrors classic wallet-api `GET /wallet-api/auth/oidc-session`.
 * Exchanges the authorization code server-side (client secret stays off the browser),
 * stores the JWT in a short-lived cookie, then redirects to `/login?oidc_login=true`.
 */
export default defineEventHandler(async (event) => {
    const oidc = getOidcConfig();
    const query = getQuery(event);
    const code = typeof query.code === "string" ? query.code : "";
    const state = typeof query.state === "string" ? query.state : "";
    const error = typeof query.error === "string" ? query.error : "";
    const expectedState = getCookie(event, "oidc.state") || "";

    deleteCookie(event, "oidc.state", {path: "/"});

    if (error) {
        throw createError({
            statusCode: 401,
            statusMessage: `OIDC provider error: ${error}`,
        });
    }

    if (!code) {
        throw createError({statusCode: 400, statusMessage: "Missing OIDC authorization code"});
    }

    if (!expectedState || state !== expectedState) {
        throw createError({statusCode: 400, statusMessage: "Invalid OIDC state"});
    }

    const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: oidc.clientId,
        redirect_uri: oidc.redirectUri,
        code,
    });
    if (oidc.clientSecret) {
        body.set("client_secret", oidc.clientSecret);
    }

    const tokenResponse = await fetch(oidc.tokenUrl, {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body,
    });

    if (!tokenResponse.ok) {
        const detail = await tokenResponse.text();
        throw createError({
            statusCode: 401,
            statusMessage: `OIDC token exchange failed: ${detail || tokenResponse.statusText}`,
        });
    }

    const tokenJson = (await tokenResponse.json()) as Record<string, unknown>;
    const idToken = typeof tokenJson.id_token === "string" ? tokenJson.id_token : "";
    const accessToken = typeof tokenJson.access_token === "string" ? tokenJson.access_token : "";
    // Prefer id_token (always a JWT for OIDC). Fall back to access_token when it is a JWT.
    const token =
        idToken ||
        (accessToken.split(".").length === 3 ? accessToken : "") ||
        accessToken;

    if (!token) {
        throw createError({
            statusCode: 401,
            statusMessage: "OIDC provider did not return id_token or access_token",
        });
    }

    setCookie(event, "oidc.session", token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
        maxAge: 60 * 5,
    });

    const postLoginRedirect = getCookie(event, "oidc.redirect") || "/";
    deleteCookie(event, "oidc.redirect", {path: "/"});

    const loginUrl = new URL(`${oidc.publicBaseUrl}/login`);
    loginUrl.searchParams.set("oidc_login", "true");
    if (postLoginRedirect.startsWith("/")) {
        loginUrl.searchParams.set("redirect", postLoginRedirect);
    }

    return sendRedirect(event, loginUrl.toString(), 302);
});
