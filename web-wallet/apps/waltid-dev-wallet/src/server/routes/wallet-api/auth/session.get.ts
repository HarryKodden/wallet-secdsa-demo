import {getCookie} from "h3";
import {walletApi2Account} from "../../../utils/walletApi2Auth";
import {sessionFromAccount} from "../../../utils/authSession";

export default defineEventHandler(async (event) => {
    const token = getCookie(event, "auth.token");
    if (!token) {
        throw createError({statusCode: 401, statusMessage: "Not authenticated"});
    }

    const account = await walletApi2Account(token);
    const oidcSession = getCookie(event, "auth.oidc") === "1";

    return sessionFromAccount(token, account, oidcSession);
});
