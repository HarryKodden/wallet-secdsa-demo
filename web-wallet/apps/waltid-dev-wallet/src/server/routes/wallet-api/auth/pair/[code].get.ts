import {getPairing} from "../../../../utils/pairStore";

/** Poll pairing status from the web UI (no secrets). */
export default defineEventHandler(async (event) => {
    const code = getRouterParam(event, "code")?.trim() || "";
    if (!code) {
        throw createError({statusCode: 400, statusMessage: "Missing code"});
    }
    const rec = getPairing(code);
    if (!rec) {
        throw createError({statusCode: 404, statusMessage: "Unknown pairing code"});
    }
    return {
        code: rec.code,
        status: rec.status,
        expiresAt: rec.expiresAt,
        deviceLabel: rec.deviceLabel,
        claimedAt: rec.claimedAt,
    };
});
