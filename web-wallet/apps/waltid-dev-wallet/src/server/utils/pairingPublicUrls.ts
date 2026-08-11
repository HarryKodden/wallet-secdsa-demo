import type {H3Event} from "h3";
import {getRequestURL} from "h3";
import {useRuntimeConfig} from "#imports";

export type PairingPublicUrls = {
    /** Browser-facing web-wallet origin (pairing / Nitro), e.g. https://wallet.example.com */
    webWalletBaseUrl: string;
    /** Phone-reachable wallet-api2 origin, e.g. https://api.example.com */
    walletApi2BaseUrl: string;
};

function trimBase(url: string): string {
    return url.trim().replace(/\/+$/, "");
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

    let api =
        (typeof publicCfg.walletApi2PublicBaseUrl === "string" &&
            publicCfg.walletApi2PublicBaseUrl.trim()) ||
        process.env.NUXT_PUBLIC_WALLET_API2_BASE_URL?.trim() ||
        process.env.WALLET2_PUBLIC_BASE_URL?.trim() ||
        "";

    // Local demo fallback when public API URL is unset.
    if (!api) {
        api = "http://localhost:7006";
    }

    return {
        webWalletBaseUrl: trimBase(web),
        walletApi2BaseUrl: trimBase(api),
    };
}
