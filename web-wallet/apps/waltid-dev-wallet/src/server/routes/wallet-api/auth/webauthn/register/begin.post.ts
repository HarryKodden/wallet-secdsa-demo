import {generateRegistrationOptions} from "@simplewebauthn/server";
import {getCookie} from "h3";
import {walletApi2Account} from "../../../../../utils/walletApi2Auth";
import {createChallenge, listCredentials} from "../../../../../utils/webauthnStore";
import {getWebAuthnConfig} from "../../../../../utils/webauthnConfig";

/**
 * Step 1 of passkey registration.
 * Returns PublicKeyCredentialCreationOptions; stores the challenge server-side.
 * Requires an active web session (auth.token cookie).
 */
export default defineEventHandler(async (event) => {
    const token = getCookie(event, "auth.token");
    if (!token) {
        throw createError({statusCode: 401, statusMessage: "Sign in first"});
    }

    const account = await walletApi2Account(token);
    const {rpId, rpName, origin} = getWebAuthnConfig(event);
    const existing = listCredentials(account.accountId);

    const options = await generateRegistrationOptions({
        rpName,
        rpID: rpId,
        userName: account.email || account.accountId,
        userDisplayName: account.email || account.accountId,
        userID: new TextEncoder().encode(account.accountId),
        attestationType: "none",
        authenticatorSelection: {
            residentKey: "preferred",
            userVerification: "required",
            // No authenticatorAttachment constraint — allows both platform (Touch ID, Face ID,
            // Windows Hello) and roaming authenticators (YubiKey, other FIDO2 security keys).
        },
        extensions: {
            // Ask the authenticator to report PRF support at registration time.
            // @ts-expect-error PRF extension not yet typed in @simplewebauthn
            prf: {},
        },
        excludeCredentials: existing.map((c) => ({
            id: c.credentialId,
            type: "public-key",
        })),
    });

    // Persist challenge for this account (consumed at /finish)
    createChallenge(account.accountId);

    // Store the actual challenge from simplewebauthn in our store
    // (simplewebauthn generates it internally; we re-use it via cookie for stateless servers
    // but here we keep the server-side store approach matching pairStore)
    setCookie(event, "webauthn.challenge", options.challenge, {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        secure: false,
        maxAge: 60 * 3,
    });
    setCookie(event, "webauthn.accountId", account.accountId, {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        secure: false,
        maxAge: 60 * 3,
    });

    return options;
});
