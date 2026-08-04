/**
 * Returns the temporary OIDC JWT stored by `oidc-session`.
 * Mirrors classic wallet-api `GET /wallet-api/auth/oidc-token`.
 */
export default defineEventHandler((event) => {
    const token = getCookie(event, "oidc.session");
    if (!token) {
        throw createError({statusCode: 401, statusMessage: "No OIDC session"});
    }

    // One-shot: clear after the SPA has consumed it via signIn.
    deleteCookie(event, "oidc.session", {path: "/"});

    setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
    return token;
});
