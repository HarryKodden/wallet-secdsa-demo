import {walletApi2Register} from "../../../utils/walletApi2Auth";

/** Proxy registration to wallet-api2 POST /auth/register. */
export default defineEventHandler(async (event) => {
    const body = await readBody<Record<string, unknown>>(event);
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
        throw createError({statusCode: 400, statusMessage: "Email and password are required"});
    }

    const result = await walletApi2Register(email, password);
    if ("exists" in result) {
        throw createError({statusCode: 409, statusMessage: `Account '${email}' already exists`});
    }

    return {
        status: "registered",
        email,
        id: result.accountId,
        accountId: result.accountId,
    };
});
