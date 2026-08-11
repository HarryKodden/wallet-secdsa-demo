import type {H3Event} from "h3";
import {getRequestURL} from "h3";
import {useRuntimeConfig} from "#imports";

export type PairingPublicUrls = {
    /** Browser-facing web-wallet origin (pairing / Nitro), e.g. https://wallet.example.com */
    webWalletBaseUrl: string;
    /** Phone-reachable wallet-api2 origin, e.g. https://api.example.com */
    walletApi2BaseUrl: string;
    /** True when API URL is a local fallback while web is a public HTTPS host. */
    apiBaseIsLocalFallback: boolean;
};

function trimBase(url: string): string {
    return url.trim().replace(/\/+$/, "");
}

function isLocalHost(url: string): boolean {
    try {
        const u = new URL(url.includes("://") ? url : `http://${url}`);
        const h = u.hostname.toLowerCase();
        return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h === "::1";
    } catch {
        return /localhost|127\.0\.0\.1/i.test(url);
    }
}

function isPublicHttps(url: string): boolean {
    try {
        const u = new URL(url);
        return u.protocol === "https:" && !isLocalHost(url);
    } catch {
        return false;
    }
}

/**
 * Public origins advertised to mobile during device pairing (QR + exchange).
 * Prefer env FQDNs over compose-internal hostnames.
 */
export function pairingPublicUrls(event?: H3Event): PairingPublicUrls {
    const config = useRuntimeConfig();
    const publicCfg = config.public as {
        oidcPublicBaseUrl?: string;
        walletApi2PublicBaseUrl?: string;
    };

    let web =
        (typeof publicCfg.oidcPublicBaseUrl === "string" && publicCfg.oidcPublicBaseUrl.trim()) ||
        process.env.NUXT_PUBLIC_OIDC_PUBLIC_BASE_URL?.trim() ||
        "";

    if (!web && event) {
        try {
            const u = getRequestURL(event);
            web = `${u.protocol}//${u.host}`;
        } catch {
            /* ignore */
        }
    }
    if (!web) web = "http://localhost:7115";
    web = trimBase(web);

    let api =
        (typeof publicCfg.walletApi2PublicBaseUrl === "string" &&
            publicCfg.walletApi2PublicBaseUrl.trim()) ||
        process.env.NUXT_PUBLIC_WALLET_API2_BASE_URL?.trim() ||
        process.env.WALLET2_PUBLIC_BASE_URL?.trim() ||
        "";

    let apiBaseIsLocalFallback = false;
    if (!api) {
        // Only fall back to localhost for local demos. Never advertise localhost
        // into a pairing QR when the web wallet is already a public HTTPS FQDN.
        if (isPublicHttps(web)) {
            api = "";
            apiBaseIsLocalFallback = true;
            console.warn(
                "[pairing] NUXT_PUBLIC_WALLET_API2_BASE_URL / WALLET2_PUBLIC_BASE_URL unset " +
                    `while web is ${web} — refusing to advertise http://localhost:7006`,
            );
        } else {
            api = "http://localhost:7006";
            apiBaseIsLocalFallback = true;
        }
    }
    api = api ? trimBase(api) : "";

    if (api && isPublicHttps(web) && isLocalHost(api)) {
        console.warn(
            `[pairing] wallet-api2 public URL looks local (${api}) while web is ${web}. ` +
                "Set NUXT_PUBLIC_WALLET_API2_BASE_URL to your TLS API FQDN.",
        );
        apiBaseIsLocalFallback = true;
    }

    return {
        webWalletBaseUrl: web,
        walletApi2BaseUrl: api,
        apiBaseIsLocalFallback,
    };
}
