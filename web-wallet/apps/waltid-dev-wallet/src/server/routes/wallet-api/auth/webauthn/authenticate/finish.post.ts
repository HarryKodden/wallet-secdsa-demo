import {verifyAuthenticationResponse} from "@simplewebauthn/server";
import {isoBase64URL} from "@simplewebauthn/server/helpers";
import {getCookie, deleteCookie, setCookie} from "h3";
import {findCredential, updateCounter} from "../../../../../utils/webauthnStore";
import {getWebAuthnConfig} from "../../../../../utils/webauthnConfig";

/**
 * Step 2 of passkey authentication.
 * Verifies the assertion and stamps webauthn_asserted_at into a session cookie.
 * The caller (login.vue) proceeds to signIn() after this returns {verified: true}.
 */
export default defineEventHandler(async (event) => {
    const challenge = getCookie(event, "webauthn.challenge");
    const accountId = getCookie(event, "webauthn.accountId");

    deleteCookie(event, "webauthn.challenge", {path: "/"});
    deleteCookie(event, "webauthn.accountId", {path: "/"});

    if (!challenge || !accountId) {
        throw createError({statusCode: 400, statusMessage: "Missing WebAuthn authentication state"});
    }

    const body = await readBody(event);
    const {rpId, origin} = getWebAuthnConfig(event);

    const credentialId = body?.id as string;
    if (!credentialId) {
        throw createError({statusCode: 400, statusMessage: "Missing credential id"});
    }

    const stored = findCredential(credentialId);
    if (!stored || stored.accountId !== accountId) {
        throw createError({statusCode: 400, statusMessage: "Unknown credential"});
    }

    let verification;
    try {
        verification = await verifyAuthenticationResponse({
            response: body,
            expectedChallenge: challenge,
            expectedOrigin: origin,
            expectedRPID: rpId,
            requireUserVerification: true,
            credential: {
                id: stored.credentialId,
                publicKey: isoBase64URL.toBuffer(stored.publicKey),
                counter: stored.counter,
            },
        });
    } catch (err: any) {
        throw createError({statusCode: 400, statusMessage: `Authentication failed: ${err?.message}`});
    }

    if (!verification.verified) {
        throw createError({statusCode: 401, statusMessage: "WebAuthn assertion not verified"});
    }

    updateCounter(credentialId, verification.authenticationInfo.newCounter);

    // Stamp the assertion time so downstream gates (e.g. pairing QR) can check freshness.
    setCookie(event, "webauthn.asserted_at", String(Date.now()), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: false,
        maxAge: 60 * 30, // 30-min window
    });

    return {verified: true, accountId};
});
