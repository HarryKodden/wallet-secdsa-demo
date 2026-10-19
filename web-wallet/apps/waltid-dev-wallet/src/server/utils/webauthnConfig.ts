import type {H3Event} from "h3";
import {getRequestURL} from "h3";
import {resolveOidcEnv} from "./oidcEnv";

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
 *
 * Prefer live OIDC_BASE_URL from the process environment. Nuxt bakes
 * `runtimeConfig.public.oidcPublicBaseUrl` at image build time (often
 * `http://localhost:7115`), which would make browsers reject create() on the
 * real host (rpId must match the page origin).
 */
export function getWebAuthnConfig(event: H3Event): WebAuthnConfig {
    const config = useRuntimeConfig(event);
    const env = resolveOidcEnv();

    const configured = String(
        env.baseUrl ||
            config.public.oidcPublicBaseUrl ||
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
    // Behind ingress the request URL is often http:// even when the public site is HTTPS.
    // Prefer the public base URL so Secure cookies are set correctly on TLS deploys.
    let secure = String(resolveOidcEnv().baseUrl || "").startsWith("https:");
    if (!secure) {
        try {
            secure = getRequestURL(event).protocol === "https:";
        } catch {
            secure = false;
        }
    }
    return {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure,
        maxAge: 60 * 3,
    };
}
