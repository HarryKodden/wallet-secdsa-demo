import {createError, defineEventHandler, getCookie, getQuery} from "h3";
import {walletApi2Account} from "../../../../utils/walletApi2Auth";
import {getEncryptedPin} from "../../../../utils/wscaPinStore";

/**
 * GET /wallet-api/auth/webauthn/wsca-pin?accountId=…
 *
 * Returns the PRF-encrypted PIN blob stored for the given WSCA accountId,
 * or { blob: null } if none has been saved yet (first-time user).
 *
 * The blob is opaque to the server — only the browser can decrypt it using
 * the AES-GCM key derived from the passkey PRF output.
 *
 * Requires an active wallet-api2 session (auth.token cookie).
 */
export default defineEventHandler(async (event) => {
    const token = getCookie(event, "auth.token");
    if (!token) throw createError({statusCode: 401, statusMessage: "Not authenticated"});

    // Verify the session is valid (delegates to wallet-api2).
    await walletApi2Account(token);

    const query = getQuery(event);
    const accountId = (query.accountId as string | undefined)?.trim();
    if (!accountId) throw createError({statusCode: 400, statusMessage: "accountId is required"});

    const blob = getEncryptedPin(accountId);
    return {blob};
});
