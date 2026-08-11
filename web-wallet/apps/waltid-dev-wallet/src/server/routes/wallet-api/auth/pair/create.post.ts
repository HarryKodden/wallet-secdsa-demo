import {getCookie} from "h3";
import {walletApi2Account} from "../../../../utils/walletApi2Auth";
import {createPairing, pairingDeepLink, pairingTtlMs} from "../../../../utils/pairStore";
import {pairingPublicUrls} from "../../../../utils/pairingPublicUrls";
import {hasCredentials} from "../../../../utils/webauthnStore";

const PAIRING_WEBAUTHN_WINDOW_MS = 5 * 60 * 1000; // 5 min

/**
 * Authenticated web session → short-lived QR pairing code for a mobile device.
 * If the account has ≥1 passkey registered, requires a recent WebAuthn assertion
 * (webauthn.asserted_at cookie < 5 min old) before creating the code.
 *
 * Advertises public web-wallet + wallet-api2 base URLs so the phone can drop LAN IPs.
 */
export default defineEventHandler(async (event) => {
    const token = getCookie(event, "auth.token");
    if (!token) {
        throw createError({statusCode: 401, statusMessage: "Sign in on the web wallet first"});
    }

    const account = await walletApi2Account(token);

    if (hasCredentials(account.accountId)) {
        const assertedAt = Number(getCookie(event, "webauthn.asserted_at") ?? "0");
        if (!assertedAt || Date.now() - assertedAt > PAIRING_WEBAUTHN_WINDOW_MS) {
            throw createError({
                statusCode: 403,
                statusMessage: "Re-verify with your passkey before pairing a device",
            });
        }
    }

    const wscaAccountId = getCookie(event, "auth.wsca") || undefined;
    const urls = pairingPublicUrls(event);

    const pairing = createPairing({
        accountId: account.accountId,
        email: account.email || "",
        token,
        wscaAccountId,
        webWalletBaseUrl: urls.webWalletBaseUrl,
        walletApi2BaseUrl: urls.walletApi2BaseUrl,
    });

    return {
        code: pairing.code,
        deepLink: pairingDeepLink(pairing.code, urls),
        expiresAt: pairing.expiresAt,
        ttlMs: pairingTtlMs(),
        email: pairing.email,
        accountId: pairing.accountId,
        wscaAccountId: pairing.wscaAccountId,
        webWalletBaseUrl: urls.webWalletBaseUrl,
        walletApi2BaseUrl: urls.walletApi2BaseUrl,
    };
});
