import {getCookie} from "h3";
import {walletApi2Account} from "../../../../utils/walletApi2Auth";
import {createPairing, pairingDeepLink, pairingTtlMs} from "../../../../utils/pairStore";

/**
 * Authenticated web session → short-lived QR pairing code for a mobile device.
 */
export default defineEventHandler(async (event) => {
    const token = getCookie(event, "auth.token");
    if (!token) {
        throw createError({statusCode: 401, statusMessage: "Sign in on the web wallet first"});
    }

    const account = await walletApi2Account(token);
    const pairing = createPairing({
        accountId: account.accountId,
        email: account.email || "",
        token,
    });

    return {
        code: pairing.code,
        deepLink: pairingDeepLink(pairing.code),
        expiresAt: pairing.expiresAt,
        ttlMs: pairingTtlMs(),
        email: pairing.email,
        accountId: pairing.accountId,
    };
});
