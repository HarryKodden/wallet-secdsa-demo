import {claimPairing} from "../../../../utils/pairStore";

type ExchangeBody = {
    code?: string;
    deviceLabel?: string;
    platform?: string;
};

/**
 * Mobile (unauthenticated) redeems a pairing code for a wallet-api2 JWT.
 * The JWT was captured from the authenticated web session at create time.
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

    return {
        token: claimed.token,
        email: claimed.email,
        accountId: claimed.accountId,
        deviceLabel: claimed.deviceLabel,
        expiresAt: claimed.expiresAt,
    };
});
