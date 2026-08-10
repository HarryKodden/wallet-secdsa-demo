import {createError, defineEventHandler, getCookie, readBody} from "h3";
import {walletApi2Account} from "../../../../utils/walletApi2Auth";
import {setEncryptedPin, type EncryptedPinBlob} from "../../../../utils/wscaPinStore";

/**
 * POST /wallet-api/auth/webauthn/wsca-pin
 *
 * Saves a PRF-encrypted PIN blob for the given WSCA accountId.
 * Body: { accountId: string; blob: { iv: string; ct: string } }
 *
 * The server stores the ciphertext only.  Without the passkey PRF output
 * (which never leaves the authenticator) the blob cannot be decrypted.
 *
 * Requires an active wallet-api2 session (auth.token cookie).
 */
export default defineEventHandler(async (event) => {
    const token = getCookie(event, "auth.token");
    if (!token) throw createError({statusCode: 401, statusMessage: "Not authenticated"});

    await walletApi2Account(token);

    const body = (await readBody(event).catch(() => null)) ?? {};
    const {accountId, blob} = body as {accountId?: string; blob?: EncryptedPinBlob};

    if (!accountId?.trim()) throw createError({statusCode: 400, statusMessage: "accountId is required"});
    if (!blob?.iv || !blob?.ct) throw createError({statusCode: 400, statusMessage: "blob must have iv and ct"});

    setEncryptedPin(accountId.trim(), blob);
    console.info("[wsca-pin] Saved encrypted PIN blob for accountId:", accountId.trim());
    return {ok: true};
});
