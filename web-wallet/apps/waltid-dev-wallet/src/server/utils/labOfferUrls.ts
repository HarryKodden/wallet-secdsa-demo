/**
 * Rewrite issuer URLs embedded in Lab credential-offer strings so wallet-api2
 * can fetch them. Stock issuer-api2 images often bake baseUrl=http://localhost:7005;
 * public deploys must advertise a reachable FQDN.
 */

function trimBase(url: string): string {
    return url.trim().replace(/\/+$/, "");
}

/** Public browser/wallet-api2-reachable issuer origin. */
export function issuerPublicBaseUrl(): string {
    const raw =
        process.env.ISSUER_PUBLIC_BASE_URL?.trim() ||
        process.env.WALLET_ISSUER_PUBLIC_BASE_URL?.trim() ||
        "";
    return raw ? trimBase(raw) : "";
}

/**
 * Rewrite localhost / loopback issuer offer URLs to the configured public base.
 * When no public base is set, rewrites localhost → host.docker.internal (compose).
 */
export function rewriteLabCredentialOffer(offer: string): string {
    if (!offer || typeof offer !== "string") return offer;

    const publicBase = issuerPublicBaseUrl();
    const target = publicBase || "http://host.docker.internal:7005";
    const encodedTarget = encodeURIComponent(target);

    let out = offer;
    out = out.replace(/https?:\/\/localhost:7005/gi, target);
    out = out.replace(/https?:\/\/127\.0\.0\.1:7005/gi, target);
    out = out.replace(/https?:\/\/0\.0\.0\.0:7005/gi, target);
    out = out.replace(/https?:\/\/\[::1\]:7005/gi, target);
    out = out.replace(/http%3A%2F%2Flocalhost%3A7005/gi, encodedTarget);
    out = out.replace(/http%3A%2F%2F127\.0\.0\.1%3A7005/gi, encodedTarget);
    return out;
}

/** Apply offer rewrite to a Lab /issuer2/credential-offers JSON body. */
export function rewriteLabIssueResponse<T extends Record<string, unknown>>(body: T): T {
    if (!body || typeof body !== "object") return body;
    const offer = body.credentialOffer;
    if (typeof offer !== "string") return body;
    const rewritten = rewriteLabCredentialOffer(offer);
    if (rewritten === offer) return body;
    console.info(
        `[lab/issue] rewrote credentialOffer localhost issuer → ${issuerPublicBaseUrl() || "host.docker.internal:7005"}`,
    );
    return {...body, credentialOffer: rewritten};
}
