/**
 * Browser-local OID4VCI “Connections” preferences (Settings).
 *
 * Overrides deploy env for wallet client_id / redirect_uri used on receive
 * (auth-code + pre-auth). Not secrets — stored in localStorage.
 */

export const OID4VCI_CONNECTIONS_STORAGE_KEY = "oid4vci.connections.v1";

export const SANDBOX_ISSUER_HINT = "https://sandbox.dev.eduwallet.nl";

export type Oid4vciConnectionPreset = "lab" | "sandbox" | "custom";

export type Oid4vciConnection = {
    id: string;
    label: string;
    preset: Oid4vciConnectionPreset;
    /** Optional issuer origin hint (offers still carry the real credential_issuer). */
    issuerBaseUrl: string;
    clientId: string;
    redirectUri: string;
    /** Stored for future force-PAR; wallet-api2 already PAR when AS requires it. */
    forcePar: boolean;
    /** Stored for future DPoP; not wired in wallet-api2 yet. */
    useDpop: boolean;
};

export type Oid4vciConnectionsState = {
    version: 1;
    activeId: string;
    items: Oid4vciConnection[];
};

export type EnvOid4vciDefaults = {
    clientId: string;
    redirectUri: string;
    /** Public issuer hint when Lab is configured (optional). */
    labIssuerBaseUrl?: string;
};

function storage(): Storage | null {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function newId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function envDefaultsFromRuntime(runtimeConfig: {
    public: Record<string, unknown>;
}): EnvOid4vciDefaults {
    const clientId =
        String(runtimeConfig.public.oid4vciClientId || "").trim() || "wallet-secdsa-demo";
    const redirectUri =
        String(runtimeConfig.public.oid4vciRedirectUri || "").trim() ||
        `${String(runtimeConfig.public.oidcPublicBaseUrl || "http://localhost:7115").replace(/\/$/, "")}/oid4vci/callback`;
    return {clientId, redirectUri};
}

export function buildLabConnection(defaults: EnvOid4vciDefaults): Oid4vciConnection {
    return {
        id: "preset-lab",
        label: "Local Lab",
        preset: "lab",
        issuerBaseUrl: (defaults.labIssuerBaseUrl || "").trim(),
        clientId: defaults.clientId,
        redirectUri: defaults.redirectUri,
        forcePar: false,
        useDpop: false,
    };
}

export function buildSandboxConnection(defaults: EnvOid4vciDefaults): Oid4vciConnection {
    return {
        id: "preset-sandbox",
        label: "eduWallet sandbox",
        preset: "sandbox",
        issuerBaseUrl: SANDBOX_ISSUER_HINT,
        clientId: defaults.clientId,
        redirectUri: defaults.redirectUri,
        forcePar: false,
        useDpop: false,
    };
}

export function buildCustomConnection(
    defaults: EnvOid4vciDefaults,
    partial?: Partial<Oid4vciConnection>,
): Oid4vciConnection {
    return {
        id: partial?.id || newId("custom"),
        label: partial?.label?.trim() || "Custom",
        preset: "custom",
        issuerBaseUrl: partial?.issuerBaseUrl?.trim() || "",
        clientId: partial?.clientId?.trim() || defaults.clientId,
        redirectUri: partial?.redirectUri?.trim() || defaults.redirectUri,
        forcePar: Boolean(partial?.forcePar),
        useDpop: Boolean(partial?.useDpop),
    };
}

export function defaultConnectionsState(defaults: EnvOid4vciDefaults): Oid4vciConnectionsState {
    const lab = buildLabConnection(defaults);
    const sandbox = buildSandboxConnection(defaults);
    return {
        version: 1,
        activeId: lab.id,
        items: [lab, sandbox],
    };
}

function normalizeConnection(raw: unknown, defaults: EnvOid4vciDefaults): Oid4vciConnection | null {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    const id = String(o.id || "").trim();
    if (!id) return null;
    const presetRaw = String(o.preset || "custom");
    const preset: Oid4vciConnectionPreset =
        presetRaw === "lab" || presetRaw === "sandbox" ? presetRaw : "custom";
    const clientId = String(o.clientId || "").trim() || defaults.clientId;
    const redirectUri = String(o.redirectUri || "").trim() || defaults.redirectUri;
    return {
        id,
        label: String(o.label || "").trim() || (preset === "lab" ? "Local Lab" : preset === "sandbox" ? "eduWallet sandbox" : "Custom"),
        preset,
        issuerBaseUrl: String(o.issuerBaseUrl || "").trim(),
        clientId,
        redirectUri,
        forcePar: Boolean(o.forcePar),
        useDpop: Boolean(o.useDpop),
    };
}

function normalizeState(raw: unknown, defaults: EnvOid4vciDefaults): Oid4vciConnectionsState {
    const fallback = defaultConnectionsState(defaults);
    if (!raw || typeof raw !== "object") return fallback;
    const o = raw as Record<string, unknown>;
    const itemsRaw = Array.isArray(o.items) ? o.items : [];
    const items = itemsRaw
        .map((item) => normalizeConnection(item, defaults))
        .filter((c): c is Oid4vciConnection => c != null);
    if (items.length === 0) return fallback;

    // Ensure built-in presets exist (ids fixed).
    const byId = new Map(items.map((c) => [c.id, c]));
    if (!byId.has("preset-lab")) byId.set("preset-lab", buildLabConnection(defaults));
    if (!byId.has("preset-sandbox")) byId.set("preset-sandbox", buildSandboxConnection(defaults));

    const ordered = [
        byId.get("preset-lab")!,
        byId.get("preset-sandbox")!,
        ...[...byId.values()].filter((c) => c.preset === "custom"),
    ];
    const activeId = String(o.activeId || "").trim();
    const active = ordered.some((c) => c.id === activeId) ? activeId : ordered[0].id;
    return {version: 1, activeId: active, items: ordered};
}

export function loadConnectionsState(defaults: EnvOid4vciDefaults): Oid4vciConnectionsState {
    const s = storage();
    if (!s) return defaultConnectionsState(defaults);
    const raw = s.getItem(OID4VCI_CONNECTIONS_STORAGE_KEY);
    if (!raw) return defaultConnectionsState(defaults);
    try {
        return normalizeState(JSON.parse(raw), defaults);
    } catch {
        return defaultConnectionsState(defaults);
    }
}

export function saveConnectionsState(state: Oid4vciConnectionsState): void {
    const s = storage();
    if (!s) return;
    s.setItem(OID4VCI_CONNECTIONS_STORAGE_KEY, JSON.stringify({...state, version: 1}));
}

export function getActiveConnection(defaults: EnvOid4vciDefaults): Oid4vciConnection {
    const state = loadConnectionsState(defaults);
    return state.items.find((c) => c.id === state.activeId) ?? state.items[0];
}

/**
 * Env defaults, overridden by the active Connections profile when present.
 */
export function resolveOid4vciClientConfigFromConnections(runtimeConfig: {
    public: Record<string, unknown>;
}): {
    clientId: string;
    redirectUri: string;
    connection: Oid4vciConnection | null;
    forcePar: boolean;
    useDpop: boolean;
} {
    const defaults = envDefaultsFromRuntime(runtimeConfig);
    if (typeof window === "undefined") {
        return {
            clientId: defaults.clientId,
            redirectUri: defaults.redirectUri,
            connection: null,
            forcePar: false,
            useDpop: false,
        };
    }
    const connection = getActiveConnection(defaults);
    return {
        clientId: connection.clientId || defaults.clientId,
        redirectUri: connection.redirectUri || defaults.redirectUri,
        connection,
        forcePar: connection.forcePar,
        useDpop: connection.useDpop,
    };
}
