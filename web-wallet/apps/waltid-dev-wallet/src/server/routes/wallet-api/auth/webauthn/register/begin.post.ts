import {generateRegistrationOptions} from "@simplewebauthn/server";
import {getCookie} from "h3";
import {walletApi2Account} from "../../../../../utils/walletApi2Auth";
import {createChallenge, listCredentials} from "../../../../../utils/webauthnStore";
import {getWebAuthnConfig, webauthnCookieOptions} from "../../../../../utils/webauthnConfig";

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

    // Allow the caller to request a specific attachment ("platform" forces native
    // Touch ID / Windows Hello and bypasses browser-extension passkey managers
    // that may intercept but not support PRF).
    const body = await readBody(event).catch(() => null) ?? {};
    const attachment = (body as any)?.attachment as AuthenticatorAttachment | undefined;

    // WebAuthn user.id must be ≤ 64 bytes (UUID is fine; guard long ids).
    const userIdBytes = new TextEncoder().encode(account.accountId).slice(0, 64);

    const options = await generateRegistrationOptions({
        rpName,
        rpID: rpId,
        userName: account.email || account.accountId,
        userDisplayName: account.email || account.accountId,
        userID: userIdBytes,
        attestationType: "none",
        authenticatorSelection: {
            residentKey: "preferred",
            userVerification: "preferred",
            ...(attachment ? {authenticatorAttachment: attachment} : {}),
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

    // Keep server-side challenge map warm (debug / future); cookie is authoritative.
    createChallenge(account.accountId);

    const cookieOpts = webauthnCookieOptions(event);
    setCookie(event, "webauthn.challenge", options.challenge, cookieOpts);
    setCookie(event, "webauthn.accountId", account.accountId, cookieOpts);

    console.info(
        `[webauthn/register/begin] rpId=${rpId} origin=${origin} attachment=${attachment ?? "any"}`,
    );

    return options;
});
