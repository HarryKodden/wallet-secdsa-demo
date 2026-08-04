import {deleteCookie, getCookie, setCookie} from "h3";
import {
    bridgeOidcToWalletApi2,
    walletApi2Account,
    walletApi2EmailPass,
} from "../../../utils/walletApi2Auth";
import {isJwtToken, sessionFromAccount} from "../../../utils/authSession";

const AUTH_COOKIE = "auth.token";
const OIDC_FLAG_COOKIE = "auth.oidc";

function setAuthCookies(event: Parameters<typeof setCookie>[0], token: string, oidc: boolean) {
    setCookie(event, AUTH_COOKIE, token, {
        httpOnly: false,
        sameSite: "lax",
        path: "/",
        secure: false,
        maxAge: 60 * 60 * 24 * 7,
    });
    if (oidc) {
        setCookie(event, OIDC_FLAG_COOKIE, "1", {
            httpOnly: false,
            sameSite: "lax",
            path: "/",
            secure: false,
            maxAge: 60 * 60 * 24 * 7,
        });
    } else {
        deleteCookie(event, OIDC_FLAG_COOKIE, {path: "/"});
    }
}

/**
 * Login against wallet-api2:
 * - email + password → POST /auth/emailpass
 * - OIDC JWT (from SURF) → JIT account + emailpass bridge (wallet-api2 JWT)
 */
export default defineEventHandler(async (event) => {
    const body = await readBody<Record<string, unknown>>(event);
    const tokenInput = typeof body.token === "string" ? body.token : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const type = typeof body.type === "string" ? body.type : "";

    if (tokenInput && (type === "oidc" || isJwtToken(tokenInput))) {
        // SURF / external OIDC JWT — exchange for wallet-api2 session.
        const bridged = await bridgeOidcToWalletApi2(tokenInput);
        setAuthCookies(event, bridged.token, true);
        const account = await walletApi2Account(bridged.token);
        return {
            token: bridged.token,
            ...sessionFromAccount(bridged.token, account, true),
        };
    }

    if (email && password) {
        const login = await walletApi2EmailPass(email, password);
        setAuthCookies(event, login.token, false);
        const account = await walletApi2Account(login.token);
        return {
            token: login.token,
            ...sessionFromAccount(login.token, account, false),
        };
    }

    throw createError({statusCode: 400, statusMessage: "Missing login credentials"});
});
