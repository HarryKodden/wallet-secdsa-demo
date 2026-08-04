import {deleteCookie, getCookie} from "h3";
import {walletApi2Logout} from "../../../utils/walletApi2Auth";

export default defineEventHandler(async (event) => {
    const token = getCookie(event, "auth.token");
    await walletApi2Logout(token);

    deleteCookie(event, "auth.token", {path: "/"});
    deleteCookie(event, "auth.oidc", {path: "/"});

    return {status: "logged out"};
});
