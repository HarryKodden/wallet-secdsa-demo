import {navigateTo, useRoute, useState} from "nuxt/app";
import {computed, type WritableComputedRef} from "vue";

export type WalletListing = {
    id: string;
    /** Friendly label from wallet-api2; falls back to a short id when unset. */
    name: string;
    /** Raw persisted displayName from wallet-api2 (null/undefined when unset). */
    displayName?: string | null;
    createdOn: string;
    addedOn: string;
    permission: string;
    /** Number of credentials currently stored in this wallet. */
    credentialCount: number;
};

export type WalletListings = {
    account: string;
    wallets: WalletListing[];
};

type WalletListItem = {
    walletId: string;
    displayName?: string | null;
    credentialCount?: number;
};

const LOCAL_WALLET_KEY = "wallet2.walletId";

function shortId(id: string): string {
    return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function displayLabel(id: string, displayName?: string | null): string {
    const trimmed = displayName?.trim();
    return trimmed || shortId(id);
}

function toListing(item: WalletListItem): WalletListing {
    const displayName = item.displayName?.trim() || null;
    return {
        id: item.walletId,
        name: displayLabel(item.walletId, displayName),
        displayName,
        createdOn: "",
        addedOn: "",
        permission: "owner",
        credentialCount: item.credentialCount ?? 0,
    };
}

async function fetchWalletList(): Promise<WalletListItem[]> {
    const raw = await $fetch<WalletListItem[] | string[] | {walletIds?: string[]}>(
        "/wallet-api/wallet",
    );
    if (Array.isArray(raw)) {
        if (raw.length === 0) return [];
        if (typeof raw[0] === "string") {
            return (raw as string[]).map((walletId) => ({walletId, credentialCount: 0}));
        }
        return raw as WalletListItem[];
    }
    return (raw?.walletIds ?? []).map((walletId) => ({walletId, credentialCount: 0}));
}

async function createWallet(displayName?: string): Promise<WalletListItem> {
    const created = await $fetch<{walletId: string; displayName?: string | null}>(
        "/wallet-api/wallet",
        {
            method: "POST",
            body: displayName?.trim() ? {displayName: displayName.trim()} : {},
        },
    );
    if (!created?.walletId) {
        throw new Error("wallet-api2 did not return a walletId");
    }
    if (import.meta.client) {
        localStorage.setItem(LOCAL_WALLET_KEY, created.walletId);
    }
    return {
        walletId: created.walletId,
        displayName: created.displayName ?? displayName ?? null,
        credentialCount: 0,
    };
}

/** Create a new empty wallet-api2 wallet and optionally navigate to it. */
export async function createNewWallet(open = true): Promise<string> {
    const created = await createWallet();
    const listings = useState<WalletListings>("wallet2.listings", () => ({
        account: "local",
        wallets: [],
    }));
    const existing = listings.value?.wallets ?? [];
    listings.value = {
        account: "local",
        wallets: [toListing(created), ...existing.filter((w) => w.id !== created.walletId)],
    };
    if (open) {
        setWallet(created.walletId);
    }
    return created.walletId;
}

/**
 * Persist a friendly display name on wallet-api2 (Postgres / descriptor).
 */
export async function renameWallet(walletId: string, displayName: string): Promise<void> {
    const trimmed = displayName.trim().slice(0, 128);
    const updated = await $fetch<{walletId: string; displayName?: string | null}>(
        `/wallet-api/wallet/${encodeURIComponent(walletId)}`,
        {
            method: "PUT",
            body: {displayName: trimmed},
        },
    );
    const persisted = updated.displayName?.trim() || "";
    if (persisted !== trimmed) {
        throw new Error(
            "Server did not save the wallet name. Rebuild/restart wallet-api2 so the display_name column exists.",
        );
    }

    const listings = useState<WalletListings>("wallet2.listings", () => ({
        account: "local",
        wallets: [],
    }));
    const wallets = listings.value?.wallets ?? [];
    listings.value = {
        account: listings.value?.account ?? "local",
        wallets: wallets.map((w) =>
            w.id === walletId
                ? {
                      ...w,
                      displayName: persisted,
                      name: displayLabel(walletId, persisted),
                  }
                : w,
        ),
    };
}

/**
 * Delete a wallet only when it has no credentials.
 * Non-empty wallets must have credentials removed first.
 */
export async function deleteWallet(walletId: string): Promise<void> {
    const listings = useState<WalletListings>("wallet2.listings", () => ({
        account: "local",
        wallets: [],
    }));
    const known = listings.value?.wallets?.find((w) => w.id === walletId);
    const count =
        known?.credentialCount ??
        (await $fetch<unknown[]>(`/wallet-api/wallet/${walletId}/credentials`)
            .then((list) => (Array.isArray(list) ? list.length : 0))
            .catch(() => 0));

    if (count > 0) {
        throw new Error(
            count === 1
                ? "This wallet still has 1 credential. Delete it first, then remove the wallet."
                : `This wallet still has ${count} credentials. Delete them first, then remove the wallet.`,
        );
    }

    await $fetch(`/wallet-api/wallet/${encodeURIComponent(walletId)}`, {
        method: "DELETE",
    });

    const remaining = (listings.value?.wallets ?? []).filter((w) => w.id !== walletId);
    listings.value = {
        account: listings.value?.account ?? "local",
        wallets: remaining,
    };

    if (import.meta.client) {
        const stored = localStorage.getItem(LOCAL_WALLET_KEY);
        if (stored === walletId) {
            localStorage.removeItem(LOCAL_WALLET_KEY);
        }
    }
    const current = useCurrentWallet();
    if (current.value === walletId) {
        current.value = remaining[0]?.id ?? null;
    }
}

/**
 * List / auto-create wallets on wallet-api2.
 * With auth enabled, GET /wallet returns only wallets linked to the JWT account.
 * localStorage remembers the last selected wallet id for this browser.
 */
export async function listWallets() {
    const data = useState<WalletListings>("wallet2.listings", () => ({
        account: "local",
        wallets: [],
    }));

    let items: WalletListItem[] = [];
    try {
        items = await fetchWalletList();
    } catch (e) {
        console.warn("GET /wallet failed, will try create", e);
    }

    if (import.meta.client) {
        const stored = localStorage.getItem(LOCAL_WALLET_KEY);
        if (stored && !items.some((i) => i.walletId === stored)) {
            localStorage.removeItem(LOCAL_WALLET_KEY);
        } else if (stored) {
            const preferred = items.find((i) => i.walletId === stored);
            if (preferred) {
                items = [preferred, ...items.filter((i) => i.walletId !== stored)];
            }
        }
    }

    if (items.length === 0) {
        try {
            items = [await createWallet()];
        } catch (e) {
            console.error("Failed to auto-create wallet-api2 wallet", e);
        }
    }

    data.value = {
        account: "local",
        wallets: items.map(toListing),
    };
    return data;
}

/**
 * If the wallet id in the URL no longer exists (e.g. after API recreate),
 * switch to an existing wallet or create a new one and rewrite the path.
 */
export async function ensureValidWallet(): Promise<string | null> {
    if (!import.meta.client) return useCurrentWallet().value;

    const current = useCurrentWallet().value;
    let items: WalletListItem[];
    try {
        items = await fetchWalletList();
    } catch (e) {
        console.warn("Could not list wallets", e);
        return current;
    }

    const ids = items.map((i) => i.walletId);
    if (current && ids.includes(current)) {
        localStorage.setItem(LOCAL_WALLET_KEY, current);
        return current;
    }

    if (current) {
        localStorage.removeItem(LOCAL_WALLET_KEY);
        console.warn(`Wallet ${current} not found on wallet-api2; recovering`);
    }

    let nextId = ids[0];
    if (!nextId) {
        try {
            nextId = (await createWallet()).walletId;
        } catch (e) {
            console.error("Failed to create replacement wallet", e);
            return null;
        }
    }

    const route = useRoute();
    const suffix =
        typeof route.fullPath === "string"
            ? route.fullPath.replace(/^\/wallet\/[^/]+/, "")
            : "";
    setWallet(nextId, (id) => `/wallet/${id}${suffix || ""}`);
    return nextId;
}

export function setWallet(
    newWallet: string | null,
    redirectUri: ((walletId: string) => string) | undefined = (walletId) => `/wallet/${walletId}`,
) {
    useCurrentWallet().value = newWallet;
    if (import.meta.client && newWallet) {
        localStorage.setItem(LOCAL_WALLET_KEY, newWallet);
    }

    if (newWallet != null && redirectUri != undefined) navigateTo(redirectUri(newWallet));
}

export function useCurrentWallet(): WritableComputedRef<string | null> {
    const route = useRoute();
    const stored = useState<string | null>("wallet", () => null);

    if (import.meta.client && !stored.value) {
        const fromLs = localStorage.getItem(LOCAL_WALLET_KEY);
        if (fromLs) stored.value = fromLs;
    }

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
            if (import.meta.client) {
                if (v) localStorage.setItem(LOCAL_WALLET_KEY, v);
                else localStorage.removeItem(LOCAL_WALLET_KEY);
            }
        },
    });
}

/** Shared wallet list state (display names, credential counts). */
export function useWalletListings() {
    return useState<WalletListings>("wallet2.listings", () => ({
        account: "local",
        wallets: [],
    }));
}

function walletIdFromRoute(route: ReturnType<typeof useRoute>): string | null {
    const raw = route.params["wallet"];
    if (typeof raw === "string" && raw.length > 0) return raw;
    if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].length > 0) return raw[0];
    return null;
}

/**
 * Page header title for `/wallet/:wallet/...`:
 * persisted displayName when set, otherwise the full wallet UUID.
 * Null only outside wallet routes (picker keeps the greeting).
 */
export function useCurrentWalletDisplayName() {
    const route = useRoute();
    const listings = useWalletListings();
    return computed(() => {
        const id = walletIdFromRoute(route);
        if (!id) return null;
        const found = listings.value?.wallets?.find((w) => w.id === id);
        const named = found?.displayName?.trim() || null;
        return named || id;
    });
}
