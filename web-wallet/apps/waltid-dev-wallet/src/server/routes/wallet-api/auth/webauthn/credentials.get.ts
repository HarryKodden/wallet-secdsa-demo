import {getCookie} from "h3";
import {walletApi2Account} from "../../../../utils/walletApi2Auth";
import {listCredentials} from "../../../../utils/webauthnStore";

/** Returns the passkeys registered for the current session's account. */
export default defineEventHandler(async (event) => {
    const token = getCookie(event, "auth.token");
    if (!token) {
        throw createError({statusCode: 401, statusMessage: "Sign in first"});
    }
    const account = await walletApi2Account(token);
    const credentials = listCredentials(account.accountId).map((c) => ({
        credentialId: c.credentialId,
        label: c.label,
        prfCapable: c.prfCapable,
        registeredAt: c.registeredAt,
        aaguid: c.aaguid,
    }));
    return {credentials};
});
