export enum SiopRequestType {
    PRESENTATION,
    ISSUANCE,
}

const siopPrefixMapping: Map<string, SiopRequestType> = new Map([
    ["openid://", SiopRequestType.PRESENTATION],
    ["openid4vp://", SiopRequestType.PRESENTATION],
    ["mdoc-openid4vp://", SiopRequestType.PRESENTATION],
    ["haip://", SiopRequestType.PRESENTATION],
    ["openid-initiate-issuance://", SiopRequestType.ISSUANCE],
    ["openid-credential-offer://", SiopRequestType.ISSUANCE],
    ["openid-vc://", SiopRequestType.ISSUANCE],
]);

const DEEP_LINK_RE =
    /(openid(?:4vp)?|mdoc-openid4vp|haip|openid-initiate-issuance|openid-credential-offer|openid-vc):\/\/[^\s"'<>]+/i;

const OFFER_URI_HTTPS_RE =
    /https?:\/\/[^\s"'<>]*(?:credential-offer|get-credential-offer|credential_offer|\/offer\b|openid-credential-offer)[^\s"'<>]*/i;

export function fixRequest(req: string) {
    let out = req.replaceAll("\n", "").trim();
    // Some verifiers / QR wrappers emit openid4vp://?openid4vp://?client_id=…
    out = out.replace(/^(openid4vp:\/\/\?)+/i, "openid4vp://?");
    out = out.replace(/^(mdoc-openid4vp:\/\/\?)+/i, "mdoc-openid4vp://?");
    out = out.replace(/^(haip:\/\/\?)+/i, "haip://?");
    return out;
}

/**
 * Rewrite loopback verifier hosts in openid4vp request strings so wallet-api2
 * (running in-cluster / Docker) can fetch request_uri. Prefer the public origin
 * from runtimeConfig when available.
 */
export function rewriteLoopbackVerifierRequest(
    request: string,
    publicVerifierOrigin?: string,
): string {
    if (!request || typeof request !== "string") return request;
    const target = (publicVerifierOrigin || "").trim().replace(/\/+$/, "") ||
        "http://host.docker.internal:7004";
    let origin = target;
    try {
        origin = new URL(target).origin;
    } catch {
        origin = target.replace(/\/verification-session\/?$/i, "");
    }
    const encoded = encodeURIComponent(origin);
    let out = request;
    out = out.replace(/https?:\/\/localhost:7004/gi, origin);
    out = out.replace(/https?:\/\/127\.0\.0\.1:7004/gi, origin);
    out = out.replace(/https?:\/\/0\.0\.0\.0:7004/gi, origin);
    out = out.replace(/https?:\/\/\[::1\]:7004/gi, origin);
    out = out.replace(/http%3A%2F%2Flocalhost%3A7004/gi, encoded);
    out = out.replace(/http%3A%2F%2F127\.0\.0\.1%3A7004/gi, encoded);
    return out;
}

/** Drop UI-only suffixes that are not the credential_offer_uri JSON endpoint. */
export function stripOfferUiSuffix(url: string): string {
    try {
        const u = new URL(url);
        u.pathname = u.pathname.replace(/\/(qr\.png|qr|open)\/?$/i, "");
        let out = u.toString();
        if (out.endsWith("/") && u.pathname !== "/") out = out.slice(0, -1);
        return out;
    } catch {
        return url.replace(/\/(qr\.png|qr|open)\/?$/i, "");
    }
}

/**
 * Normalize pasted text / QR payload from another browser tab into a SIOP deep link.
 * Accepts deep links, HTTPS credential-offer URLs, or larger clipboard blobs that contain them.
 */
export function normalizeRequest(raw: string): string {
    let req = fixRequest(raw).replace(/^['"]|['"]$/g, "");

    const deep = req.match(DEEP_LINK_RE);
    if (deep) {
        return fixRequest(deep[0]);
    }

    // Bare HTTPS offer endpoint → wrap as OID4VCI credential-offer deep link
    if (
        /^https?:\/\//i.test(req) &&
        /credential-offer|get-credential-offer|credential_offer|\/offer\b|openid-credential-offer/i.test(req)
    ) {
        // Already a deep-link wrapper page? Prefer query param if present
        try {
            const u = new URL(req);
            const nested =
                u.searchParams.get("credential_offer_uri") ||
                u.searchParams.get("credential_offer") ||
                u.searchParams.get("url") ||
                u.searchParams.get("request");
            if (nested) {
                const decoded = decodeURIComponent(nested);
                if (/^openid(-credential-offer|-initiate-issuance|-vc)?:\/\//i.test(decoded) ||
                    /^openid4vp:\/\//i.test(decoded)) {
                    return fixRequest(decoded);
                }
                if (/^https?:\/\//i.test(decoded)) {
                    return `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(
                        stripOfferUiSuffix(decoded),
                    )}`;
                }
            }
            // SURF / demo UIs expose …/credential-offer/{id}/qr.png or /open — fetch the offer JSON id.
            req = stripOfferUiSuffix(u.toString());
        } catch {
            /* keep wrapping whole URL */
        }
        return `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(req)}`;
    }

    const httpsOffer = req.match(OFFER_URI_HTTPS_RE);
    if (httpsOffer) {
        return normalizeRequest(httpsOffer[0]);
    }

    // Query fragment credential_offer_uri=https%3A%2F%2F...
    const uriParam = req.match(/credential_offer_uri=([^&\s"'<>]+)/i);
    if (uriParam) {
        let uri = uriParam[1];
        try {
            uri = decodeURIComponent(uri);
        } catch {
            /* keep raw */
        }
        if (/^https?:\/\//i.test(uri)) {
            return `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(uri)}`;
        }
    }

    return req;
}

export function encodeRequest(req: string) {
    // UTF-8 safe base64url (btoa throws on non-Latin1 offer URLs)
    const bytes = new TextEncoder().encode(req);
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
}

export function decodeRequest(encoded: string) {
    const padded = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

export function isSiopRequest(req: string): boolean {
    return getSiopRequestType(normalizeRequest(req)) != null;
}

export function getSiopRequestType(req: string): SiopRequestType | null {
    req = normalizeRequest(req);

    for (let [key, value] of siopPrefixMapping) {
        if (req.startsWith(key)) return value;
    }
    if (req.includes("presentationRequests")) { // MS Entra!
        return SiopRequestType.PRESENTATION;
    } else if (req.includes("issuanceRequests")) { // MS Entra
        return SiopRequestType.ISSUANCE;
    } else
        return null;
}
