import {navigateTo, useRoute, useState} from "nuxt/app";
import {computed, type WritableComputedRef} from "vue";

export type WalletListing = {
    id: string,
    name: string
    createdOn: string
    addedOn: string
    permission: string
}

export type WalletListings = {
    account: string,
    wallets: WalletListing[]
}

function toListing(id: string): WalletListing {
    return {
        id,
        name: id.slice(0, 8) + "…",
        createdOn: "",
        addedOn: "",
        permission: "owner",
    };
}

const LOCAL_WALLET_KEY = "wallet2.walletId";

async function fetchWalletIds(): Promise<string[]> {
    const ids = await $fetch<string[] | { walletIds?: string[] }>("/wallet-api/wallet");
    return Array.isArray(ids) ? ids : (ids?.walletIds ?? []);
}

async function createWallet(): Promise<string> {
    const created = await $fetch<{ walletId: string }>("/wallet-api/wallet", {
        method: "POST",
        body: {},
    });
    if (!created?.walletId) {
        throw new Error("wallet-api2 did not return a walletId");
    }
    if (import.meta.client) {
        localStorage.setItem(LOCAL_WALLET_KEY, created.walletId);
    }
    return created.walletId;
}

/** Create a new empty wallet-api2 wallet and optionally navigate to it. */
export async function createNewWallet(open = true): Promise<string> {
    const walletId = await createWallet();
    const listings = useState<WalletListings>("wallet2.listings", () => ({
        account: "local",
        wallets: [],
    }));
    const existing = listings.value?.wallets ?? [];
    listings.value = {
        account: "local",
        wallets: [toListing(walletId), ...existing.filter((w) => w.id !== walletId)],
    };
    if (open) {
        setWallet(walletId);
    }
    return walletId;
}

/**
 * List / auto-create wallets on wallet-api2.
 * Auth is optional on wallet-api2 today — when auth is off we keep a wallet id in localStorage.
 */
export async function listWallets() {
    const data = useState<WalletListings>("wallet2.listings", () => ({
        account: "local",
        wallets: [],
    }));

    let ids: string[] = [];
    try {
        ids = await fetchWalletIds();
    } catch (e) {
        console.warn("GET /wallet failed, will try create", e);
    }

    let wallets = ids.map(toListing);

    // Prefer a previously stored id only if it still exists on the backend
    // (recreating wallet-api2 / wiping DB leaves stale localStorage / deep links).
    if (import.meta.client) {
        const stored = localStorage.getItem(LOCAL_WALLET_KEY);
        if (stored && !wallets.some((w) => w.id === stored)) {
            localStorage.removeItem(LOCAL_WALLET_KEY);
        } else if (stored && wallets.some((w) => w.id === stored)) {
            wallets = [
                toListing(stored),
                ...wallets.filter((w) => w.id !== stored),
            ];
        }
    }

    if (wallets.length === 0) {
        try {
            const walletId = await createWallet();
            wallets = [toListing(walletId)];
        } catch (e) {
            console.error("Failed to auto-create wallet-api2 wallet", e);
        }
    }

    data.value = {account: "local", wallets};
    return data;
}

/**
 * If the wallet id in the URL no longer exists (e.g. after API recreate),
 * switch to an existing wallet or create a new one and rewrite the path.
 *
 * Never create a replacement wallet while the list endpoint is merely failing —
 * that produced empty "new" wallets on refresh.
 */
export async function ensureValidWallet(): Promise<string | null> {
    if (!import.meta.client) return useCurrentWallet().value;

    const current = useCurrentWallet().value;
    let ids: string[];
    try {
        ids = await fetchWalletIds();
    } catch (e) {
        console.warn("Could not list wallets", e);
        return current;
    }

    if (current && ids.includes(current)) {
        localStorage.setItem(LOCAL_WALLET_KEY, current);
        return current;
    }

    // Stale deep link — recover to an existing wallet when possible
    if (current) {
        localStorage.removeItem(LOCAL_WALLET_KEY);
        console.warn(`Wallet ${current} not found on wallet-api2; recovering`);
    }

    let nextId = ids[0];
    if (!nextId) {
        // Only create when the backend truly has zero wallets
        try {
            nextId = await createWallet();
        } catch (e) {
            console.error("Failed to create replacement wallet", e);
            return null;
        }
    }

    const route = useRoute();
    const suffix = typeof route.fullPath === "string"
        ? route.fullPath.replace(/^\/wallet\/[^/]+/, "")
        : "";
    setWallet(nextId, (id) => `/wallet/${id}${suffix || ""}`);
    return nextId;
}

export function setWallet(
    newWallet: string | null,
    redirectUri: ((walletId: string) => string) | undefined = (walletId) => `/wallet/${walletId}`
) {
    useCurrentWallet().value = newWallet;
    if (import.meta.client && newWallet) {
        localStorage.setItem(LOCAL_WALLET_KEY, newWallet);
    }

    if (newWallet != null && redirectUri != undefined)
        navigateTo(redirectUri(newWallet));
}

/**
 * Current wallet id — always prefer the `:wallet` route param so hard refresh
 * and in-app navigation stay aligned (useState alone only init'd once).
 */
export function useCurrentWallet(): WritableComputedRef<string | null> {
    const route = useRoute();
    const stored = useState<string | null>("wallet", () => null);

    return computed({
        get() {
            const fromRoute = route.params["wallet"];
            if (typeof fromRoute === "string" && fromRoute.length > 0) {
                return fromRoute;
            }
            return stored.value;
        },
        set(v: string | null) {
            stored.value = v;
        },
    });
}
