/**
 * Rewrite localhost verifier URLs in Lab verification-session responses so
 * wallet-api2 can fetch request_uri / post to response_uri.
 * Stock verifier-api2 images bake urlPrefix=http://localhost:7004/verification-session.
 */

function trimBase(url: string): string {
    return url.trim().replace(/\/+$/, "");
}

/** Public browser/wallet-api2-reachable verifier verification-session prefix. */
export function verifierPublicUrlPrefix(): string {
    const raw =
        process.env.VERIFIER_PUBLIC_URL_PREFIX?.trim() ||
        process.env.WALLET_VERIFIER_PUBLIC_URL_PREFIX?.trim() ||
        "";
    return raw ? trimBase(raw) : "";
}

function verifierPublicOrigin(): string {
    const prefix = verifierPublicUrlPrefix();
    if (prefix) {
        try {
            return new URL(prefix).origin;
        } catch {
            return prefix.replace(/\/verification-session\/?$/i, "");
        }
    }
    return "http://host.docker.internal:7004";
}

/**
 * Rewrite localhost / loopback verifier URLs embedded in openid4vp:// request strings.
 */
export function rewriteLabPresentationRequest(requestUrl: string): string {
    if (!requestUrl || typeof requestUrl !== "string") return requestUrl;

    const targetOrigin = verifierPublicOrigin();
    const encodedTarget = encodeURIComponent(targetOrigin);

    let out = requestUrl;
    out = out.replace(/https?:\/\/localhost:7004/gi, targetOrigin);
    out = out.replace(/https?:\/\/127\.0\.0\.1:7004/gi, targetOrigin);
    out = out.replace(/https?:\/\/0\.0\.0\.0:7004/gi, targetOrigin);
    out = out.replace(/https?:\/\/\[::1\]:7004/gi, targetOrigin);
    out = out.replace(/http%3A%2F%2Flocalhost%3A7004/gi, encodedTarget);
    out = out.replace(/http%3A%2F%2F127\.0\.0\.1%3A7004/gi, encodedTarget);
    return out;
}

/** Apply rewrite to Lab /verification-session/create JSON body URL fields. */
export function rewriteLabVerifyResponse<T extends Record<string, unknown>>(body: T): T {
    if (!body || typeof body !== "object") return body;
    let changed = false;
    const next: Record<string, unknown> = {...body};
    for (const key of [
        "bootstrapAuthorizationRequestUrl",
        "fullAuthorizationRequestUrl",
        "requestUrl",
        "authorizationRequestUrl",
    ]) {
        const value = next[key];
        if (typeof value !== "string") continue;
        const rewritten = rewriteLabPresentationRequest(value);
        if (rewritten !== value) {
            next[key] = rewritten;
            changed = true;
        }
    }
    if (!changed) return body;
    console.info(
        `[lab/verify] rewrote localhost verifier → ${verifierPublicOrigin()}`,
    );
    return next as T;
}
