import {deleteCookie, sendRedirect} from "h3";

export default defineEventHandler(async (event) => {
    deleteCookie(event, "auth.token", {path: "/"});
    return sendRedirect(event, "/login", 302);
});
