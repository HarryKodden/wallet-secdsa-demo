import {rewriteLabPresentationRequest} from "../../utils/labVerifyUrls";

/**
 * Proxy `/wallet-api/**` to wallet-api2, stripping the `/wallet-api` prefix.
 *
 * Auth endpoints live in sibling files under `auth/` and are more specific, so they
 * win over this catch-all. Do not put auth behind nitro `routeRules.proxy` — parent
 * `/wallet-api/**` proxy rules inherit onto `/wallet-api/auth/**` and 404 OIDC.
 *
 * Node `fetch` auto-decompresses gzip/br responses. Do not forward content-encoding
 * / content-length from upstream, or Caddy (and browsers) see "gzip: invalid header"
 * and abort — which surfaces in the UI as failed DID/key API calls even when
 * wallet-api2 returned 201.
 */
export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig();
    const targetBase = String(
        config.walletApi2Proxy || process.env.WALLET_API2_PROXY || "http://wallet-api2:7006"
    ).replace(/\/$/, "");

    const requestUrl = getRequestURL(event);
    const stripped = requestUrl.pathname.replace(/^\/wallet-api/, "") || "/";
    const url = new URL(stripped + requestUrl.search, targetBase);

    const method = event.method;
    const headers = getRequestHeaders(event);
    const outbound: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        if (!value) continue;
        const lower = key.toLowerCase();
        // Drop hop-by-hop / length / encoding so upstream returns plain bodies that
        // match what we stream back after Node fetch decompresses.
        if (
            lower === "host" ||
            lower === "connection" ||
            lower === "content-length" ||
            lower === "accept-encoding"
        ) {
            continue;
        }
        outbound[key] = Array.isArray(value) ? value.join(",") : String(value);
    }

    // wallet-api2 auth: inject Bearer from Nuxt auth.token cookie when the SPA
    // only sends the cookie (same cookie name is also accepted upstream).
    const hasAuthHeader = Boolean(
        outbound.authorization || outbound.Authorization || outbound["ktor-authnz-auth"],
    );
    if (!hasAuthHeader) {
        const cookieToken = getCookie(event, "auth.token");
        if (cookieToken) {
            outbound.Authorization = `Bearer ${cookieToken}`;
        }
    }

    const hasBody = !["GET", "HEAD"].includes(method.toUpperCase());
    let body = hasBody ? await readRawBody(event) : undefined;

    // Pasted openid4vp QRs often still embed localhost:7004 request_uri from stock
    // verifier images — rewrite before wallet-api2 tries to fetch them.
    if (
        body &&
        method.toUpperCase() === "POST" &&
        /\/credentials\/present\/(?:resolve-request|preview)$/.test(stripped)
    ) {
        try {
            const parsed = JSON.parse(
                typeof body === "string" ? body : Buffer.from(body).toString("utf8"),
            ) as {requestUrl?: unknown};
            if (typeof parsed.requestUrl === "string") {
                const rewritten = rewriteLabPresentationRequest(parsed.requestUrl);
                if (rewritten !== parsed.requestUrl) {
                    parsed.requestUrl = rewritten;
                    body = JSON.stringify(parsed);
                    outbound["content-type"] = "application/json";
                    console.info(
                        `[wallet-api proxy] rewrote localhost verifier in ${stripped}`,
                    );
                }
            }
        } catch {
            /* leave body unchanged */
        }
    }

    const upstream = await fetch(url, {
        method,
        headers: outbound,
        body,
        redirect: "manual",
    });

    setResponseStatus(event, upstream.status);
    upstream.headers.forEach((value, key) => {
        const lower = key.toLowerCase();
        if (
            lower === "transfer-encoding" ||
            lower === "connection" ||
            lower === "content-encoding" ||
            lower === "content-length"
        ) {
            return;
        }
        setResponseHeader(event, key, value);
    });

    return Buffer.from(await upstream.arrayBuffer());
});
