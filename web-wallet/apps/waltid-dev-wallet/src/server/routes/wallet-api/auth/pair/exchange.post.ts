import {claimPairing} from "../../../../utils/pairStore";
import {pairingPublicUrls} from "../../../../utils/pairingPublicUrls";

type ExchangeBody = {
    code?: string;
    deviceLabel?: string;
    platform?: string;
};

/**
 * Mobile (unauthenticated) redeems a pairing code for a wallet-api2 JWT.
 * The JWT was captured from the authenticated web session at create time.
 * Also returns public base URLs so the device can target TLS FQDNs.
 */
export default defineEventHandler(async (event) => {
    const body = (await readBody(event)) as ExchangeBody;
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!code) {
        throw createError({statusCode: 400, statusMessage: "Missing pairing code"});
    }

    const claimed = claimPairing(code, {
        label: body.deviceLabel,
        platform: body.platform,
    });

    const live = pairingPublicUrls(event);
    const webWalletBaseUrl = claimed.webWalletBaseUrl || live.webWalletBaseUrl;
    const walletApi2BaseUrl = claimed.walletApi2BaseUrl || live.walletApi2BaseUrl;

    return {
        token: claimed.token,
        email: claimed.email,
        accountId: claimed.accountId,
        wscaAccountId: claimed.wscaAccountId,
        deviceLabel: claimed.deviceLabel,
        expiresAt: claimed.expiresAt,
        webWalletBaseUrl,
        walletApi2BaseUrl: walletApi2BaseUrl || null,
        apiBaseIsLocalFallback: live.apiBaseIsLocalFallback && !claimed.walletApi2BaseUrl,
    };
});
