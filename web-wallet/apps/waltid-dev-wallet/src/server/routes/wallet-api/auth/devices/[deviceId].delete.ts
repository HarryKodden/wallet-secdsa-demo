import {getCookie} from "h3";
import {walletApi2Account} from "../../../../utils/walletApi2Auth";
import {revokeDevice} from "../../../../utils/pairStore";

export default defineEventHandler(async (event) => {
    const token = getCookie(event, "auth.token");
    if (!token) {
        throw createError({statusCode: 401, statusMessage: "Not authenticated"});
    }
    const deviceId = getRouterParam(event, "deviceId")?.trim() || "";
    if (!deviceId) {
        throw createError({statusCode: 400, statusMessage: "Missing deviceId"});
    }
    const account = await walletApi2Account(token);
    const ok = revokeDevice(account.accountId, deviceId);
    if (!ok) {
        throw createError({statusCode: 404, statusMessage: "Device not found"});
    }
    return {ok: true};
});
