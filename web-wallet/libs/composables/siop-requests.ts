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
    return req.replaceAll("\n", "").trim();
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
                    return `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(decoded)}`;
                }
            }
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
