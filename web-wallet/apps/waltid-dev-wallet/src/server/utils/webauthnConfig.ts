import type {H3Event} from "h3";

export type WebAuthnConfig = {
    rpId: string;
    rpName: string;
    origin: string;
};

/**
 * Derives the WebAuthn RP configuration from the public base URL.
 * In development (localhost) we use "localhost" as both rpId and origin host.
 */
export function getWebAuthnConfig(event: H3Event): WebAuthnConfig {
    const config = useRuntimeConfig(event);
    const publicBaseUrl = String(
        config.public.oidcPublicBaseUrl || config.public.walletPublicBaseUrl || "http://localhost:7115",
    );

    let origin = publicBaseUrl.replace(/\/$/, "");
    let rpId: string;
    try {
        const u = new URL(origin);
        rpId = u.hostname;
        // WebAuthn origin must include scheme + host + port (if non-standard)
        origin = u.port && u.port !== "443" && u.port !== "80"
            ? `${u.protocol}//${u.hostname}:${u.port}`
            : `${u.protocol}//${u.hostname}`;
    } catch {
        rpId = "localhost";
        origin = "http://localhost:7115";
    }

    const rpName = String(config.public.appName || "SECDSA Wallet");

    return {rpId, rpName, origin};
}
