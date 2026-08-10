import {verifyRegistrationResponse} from "@simplewebauthn/server";
import {isoBase64URL} from "@simplewebauthn/server/helpers";
import {getCookie, deleteCookie} from "h3";
import {saveCredential} from "../../../../../utils/webauthnStore";
import {getWebAuthnConfig} from "../../../../../utils/webauthnConfig";

/**
 * Step 2 of passkey registration.
 * Verifies the authenticator's attestation and persists the credential.
 */
export default defineEventHandler(async (event) => {
    const challenge = getCookie(event, "webauthn.challenge");
    const accountId = getCookie(event, "webauthn.accountId");

    deleteCookie(event, "webauthn.challenge", {path: "/"});
    deleteCookie(event, "webauthn.accountId", {path: "/"});

    if (!challenge || !accountId) {
        throw createError({statusCode: 400, statusMessage: "Missing WebAuthn registration state"});
    }

    const body = await readBody(event);
    const {rpId, origin} = getWebAuthnConfig(event);

    let verification;
    try {
        verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge: challenge,
            expectedOrigin: origin,
            expectedRPID: rpId,
            requireUserVerification: true,
        });
    } catch (err: any) {
        throw createError({statusCode: 400, statusMessage: `Registration failed: ${err?.message}`});
    }

    if (!verification.verified || !verification.registrationInfo) {
        throw createError({statusCode: 400, statusMessage: "Registration not verified"});
    }

    const {credential, aaguid} = verification.registrationInfo;

    // Detect PRF capability.
    // @simplewebauthn/server v10+ renamed extensionsData → authenticatorExtensionResults.
    // Also check the client-side result (prf.enabled = true when the authenticator
    // confirmed PRF support during registration).
    const prfCapable =
        (body?.clientExtensionResults?.prf?.enabled === true) ||
        (verification.registrationInfo.authenticatorExtensionResults as any)?.prf?.enabled === true;

    const label = typeof body?.label === "string" && body.label.trim()
        ? body.label.trim()
        : "Passkey";

    // In @simplewebauthn/server v10+, credential.id is already a Base64URLString.
    // credential.publicKey is still a Uint8Array and must be encoded for storage.
    saveCredential({
        credentialId: credential.id,
        accountId,
        email: "",
        publicKey: isoBase64URL.fromBuffer(credential.publicKey),
        counter: credential.counter,
        prfCapable,
        registeredAt: Date.now(),
        label,
        aaguid: aaguid ?? "",
    });

    return {verified: true, prfCapable};
});
