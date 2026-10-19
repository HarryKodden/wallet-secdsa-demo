import type {H3Event} from "h3";
import {getRequestURL} from "h3";

export type WebAuthnConfig = {
    rpId: string;
    rpName: string;
    origin: string;
};

function originFromUrl(raw: string): {origin: string; rpId: string} | null {
    try {
        const u = new URL(raw);
        const rpId = u.hostname;
        const origin =
            u.port && u.port !== "443" && u.port !== "80"
                ? `${u.protocol}//${u.hostname}:${u.port}`
                : `${u.protocol}//${u.hostname}`;
        return {origin, rpId};
    } catch {
        return null;
    }
}

/**
 * WebAuthn RP config.
 * Prefer the browser-facing public base (OIDC_BASE_URL); fall back to the
 * request URL when proxies set X-Forwarded-* correctly.
 */
export function getWebAuthnConfig(event: H3Event): WebAuthnConfig {
    const config = useRuntimeConfig(event);
    const configured = String(
        config.public.oidcPublicBaseUrl ||
            process.env.OIDC_BASE_URL ||
            config.public.walletPublicBaseUrl ||
            "",
    ).trim();

    let parsed = configured ? originFromUrl(configured) : null;

    if (!parsed) {
        try {
            parsed = originFromUrl(getRequestURL(event).href);
        } catch {
            parsed = null;
        }
    }

    if (!parsed) {
        parsed = {origin: "http://localhost:7115", rpId: "localhost"};
    }

    const rpName = String(config.public.appName || "SECDSA Wallet");
    return {rpId: parsed.rpId, rpName, origin: parsed.origin};
}

/** Cookie flags for short-lived WebAuthn challenge state. */
export function webauthnCookieOptions(event: H3Event) {
    let secure = false;
    try {
        secure = getRequestURL(event).protocol === "https:";
    } catch {
        secure = String(process.env.OIDC_BASE_URL || "").startsWith("https:");
    }
    return {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure,
        maxAge: 60 * 3,
    };
}
