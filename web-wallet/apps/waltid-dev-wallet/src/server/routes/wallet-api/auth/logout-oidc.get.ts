import {deleteCookie, sendRedirect} from "h3";

export default defineEventHandler(async (event) => {
    deleteCookie(event, "auth.token", {path: "/"});
    deleteCookie(event, "auth.oidc", {path: "/"});
    deleteCookie(event, "auth.wsca", {path: "/"});
    return sendRedirect(event, "/login", 302);
});
