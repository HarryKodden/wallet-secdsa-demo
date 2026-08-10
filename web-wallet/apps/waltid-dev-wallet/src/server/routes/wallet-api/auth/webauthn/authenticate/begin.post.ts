import {generateAuthenticationOptions} from "@simplewebauthn/server";
import {getCookie} from "h3";
import {walletApi2Account} from "../../../../../utils/walletApi2Auth";
import {findCredentialsForAccount, hasCredentials} from "../../../../../utils/webauthnStore";
import {getWebAuthnConfig} from "../../../../../utils/webauthnConfig";

/**
 * Step 1 of passkey authentication.
 * Called from login.vue after the OIDC token is fetched, before signIn().
 * Requires the oidc.account cookie set by a preceding /oidc-token exchange,
 * OR an active auth.token session (for re-assertion, e.g. before pairing).
 *
 * Query param: ?accountId=<id>  (passed by login.vue after decoding the OIDC token)
 */
export default defineEventHandler(async (event) => {
    const {rpId} = getWebAuthnConfig(event);
    const query = getQuery(event);
    const body = (await readBody(event).catch(() => null)) ?? {} as Record<string, unknown>;

    // accountId can come from query string or POST body
    let accountId = (typeof query.accountId === "string" ? query.accountId : null)
        || (typeof body.accountId === "string" ? body.accountId : null);

    // Fallback: already-authenticated session (re-assertion before pairing)
    if (!accountId) {
        const token = getCookie(event, "auth.token");
        if (token) {
            const account = await walletApi2Account(token).catch(() => null);
            accountId = account?.accountId ?? null;
        }
    }

    if (!accountId) {
        throw createError({statusCode: 400, statusMessage: "accountId required"});
    }

    if (!hasCredentials(accountId)) {
        return {noCredentials: true};
    }

    const credentials = findCredentialsForAccount(accountId);

    const options = await generateAuthenticationOptions({
        rpID: rpId,
        userVerification: "required",
        allowCredentials: credentials.map((c) => ({
            id: c.credentialId,
            type: "public-key",
        })),
        // Always advertise PRF — the client adds eval.first (per-account APP_SALT)
        // client-side so the salt never reaches the server.  Authenticators that
        // don't support PRF will simply omit it from the response.
        extensions: {prf: {}} as any,
    });

    setCookie(event, "webauthn.challenge", options.challenge, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
        maxAge: 60 * 3,
    });
    setCookie(event, "webauthn.accountId", accountId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
        maxAge: 60 * 3,
    });

    return {...options, resolvedAccountId: accountId};
});
