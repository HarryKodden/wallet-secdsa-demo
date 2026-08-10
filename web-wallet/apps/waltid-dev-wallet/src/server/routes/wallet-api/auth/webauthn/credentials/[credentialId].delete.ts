import {getCookie} from "h3";
import {walletApi2Account} from "../../../../../utils/walletApi2Auth";
import {removeCredential} from "../../../../../utils/webauthnStore";

/** Removes a registered passkey by credentialId. */
export default defineEventHandler(async (event) => {
    const token = getCookie(event, "auth.token");
    if (!token) {
        throw createError({statusCode: 401, statusMessage: "Sign in first"});
    }
    const account = await walletApi2Account(token);
    const credentialId = decodeURIComponent(getRouterParam(event, "credentialId") ?? "");
    if (!credentialId) {
        throw createError({statusCode: 400, statusMessage: "Missing credentialId"});
    }
    const removed = removeCredential(account.accountId, credentialId);
    if (!removed) {
        throw createError({statusCode: 404, statusMessage: "Credential not found"});
    }
    return {removed: true};
});
