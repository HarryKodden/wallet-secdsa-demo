/**
 * OID4VCI authorization_code grant helpers for the demo web wallet.
 *
 * Persists OAuth `state` + PKCE `code_verifier` (and issuance context) in
 * sessionStorage across the AS redirect. `issuer_state` from the offer is
 * handled by wallet-api2 when building the authorization URL — do not confuse
 * it with this OAuth `state`.
 */

export const OID4VCI_AUTH_CODE_STORAGE_KEY = "oid4vci.authCode.continuation";
export const OID4VCI_AUTH_CODE_NOTICE_KEY = "oid4vci.authCode.notice";
export const OID4VCI_AUTH_CODE_TTL_MS = 15 * 60 * 1000;

export type Oid4vciAuthCodeContinuation = {
    /** OAuth 2.0 / OIDC `state` (CSRF) — not OID4VCI `issuer_state`. */
    state: string;
    codeVerifier: string | null;
    credentialIssuerBaseUrl: string;
    credentialConfigurationId: string;
    credentialEndpoint: string;
    nonceEndpoint: string | null;
    walletId: string;
    did: string | null;
    clientId: string;
    redirectUri: string;
    offerUrl: string;
    createdAt: number;
};

export type AuthCodeSessionNotice = {
    kind: "expired" | "cancelled";
    walletId: string | null;
    credentialConfigurationId: string | null;
    at: number;
};

export type AuthCodeContinuationLookup =
    | { status: "none" }
    | {
          status: "pending";
          continuation: Oid4vciAuthCodeContinuation;
          expiresAt: number;
          remainingMs: number;
      }
    | {
          status: "expired";
          continuation: Oid4vciAuthCodeContinuation;
      }
    | { status: "invalid" };

export type AuthCodeContinuationResolve =
    | { ok: true; continuation: Oid4vciAuthCodeContinuation }
    | { ok: false; reason: "missing" | "expired" | "mismatch" | "invalid" };

/**
 * Turn wallet-api2 / issuer receive errors into short guidance for the UI.
 * Prefer explaining issuer/IdP policy over raw protocol text; never invent missing claims.
 */
export function formatOid4vciReceiveError(
    err: unknown,
    opts?: {oid4vciRedirectUri?: string},
): string {
    const text = extractReceiveErrorText(err);
    if (!text) return "Credential issuance failed.";

    const jsonPath = text.match(/JSON path\s+(\$\.[\w.-]+)/i)?.[1];
    if (jsonPath || /does not exist,\s*or evaluates to null/i.test(text)) {
        const claim = (jsonPath ?? "$.…").replace(/^\$\./, "");
        return (
            `The issuer needs “${claim}” from your login, but your identity provider did not provide it ` +
            `(that field was missing or null in the ID token).\n\n` +
            `Sign in with an account that has a full profile, ask the IdP to release that claim, ` +
            `or pick a credential offer that does not require it.\n\n` +
            `This is not a SoftHSM / wallet signing problem.`
        );
    }

    if (/no entitlement found/i.test(text) || /credential_request_denied/i.test(text)) {
        return (
            `The issuer denied this credential for your account (entitlement / policy), ` +
            `not because of a wallet proof failure.\n\n` +
            `Use an entitled account for that card, or try a pre-authorized / freeform offer instead.`
        );
    }

    if (/redirect_uri|invalid_client|unauthorized_client/i.test(text)) {
        const redirect = opts?.oid4vciRedirectUri?.trim();
        return (
            `${text}\n\nCheck OID4VCI_CLIENT_ID / OID4VCI_REDIRECT_URI are registered at the issuer’s ` +
            `authorization server` +
            (redirect ? ` (redirect: ${redirect})` : "") +
            `.`
        );
    }

    if (/invalid_proof/i.test(text)) {
        return (
            `${text}\n\nUsually SoftHSM was not unlocked, or the proof key/DID is stale. ` +
            `Unlock with the SECDSA PIN, or regenerate key + did:jwk on this wallet and retry with a fresh offer.`
        );
    }

    if (/invalid_request/i.test(text)) {
        return (
            `${text}\n\nOften a stale SECDSA key/DID after SoftHSM re-key, or a burned single-use offer. ` +
            `Delete this wallet’s SECDSA key and did:jwk, regenerate both, then use a fresh offer.`
        );
    }

    return text;
}

function extractReceiveErrorText(err: unknown): string {
    if (err == null) return "";
    if (typeof err === "string") {
        const trimmed = err.trim();
        if (trimmed.startsWith("{")) {
            try {
                return extractReceiveErrorText(JSON.parse(trimmed));
            } catch {
                return trimmed;
            }
        }
        return trimmed;
    }
    if (typeof err === "object") {
        const o = err as Record<string, unknown>;
        const data = o.data;
        if (typeof data === "string" && data.trim()) return extractReceiveErrorText(data);
        if (data && typeof data === "object") {
            const d = data as Record<string, unknown>;
            const nested =
                (typeof d.message === "string" && d.message) ||
                (typeof d.statusMessage === "string" && d.statusMessage) ||
                (typeof d.error_description === "string" && d.error_description) ||
                (typeof d.error === "string" && d.error);
            if (nested) return String(nested);
        }
        const top =
            (typeof o.message === "string" && o.message) ||
            (typeof o.statusMessage === "string" && o.statusMessage) ||
            (typeof o.error_description === "string" && o.error_description);
        if (top) return String(top);
    }
    return String(err);
}

function storage(): Storage | null {
    if (!import.meta.client) return null;
    try {
        return sessionStorage;
    } catch {
        return null;
    }
}

function parseContinuation(raw: string): Oid4vciAuthCodeContinuation | null {
    try {
        const parsed = JSON.parse(raw) as Oid4vciAuthCodeContinuation;
        if (!parsed?.state || !parsed.credentialIssuerBaseUrl || !parsed.walletId) return null;
        if (typeof parsed.createdAt !== "number") return null;
        return parsed;
    } catch {
        return null;
    }
}

function saveNotice(notice: AuthCodeSessionNotice): void {
    storage()?.setItem(OID4VCI_AUTH_CODE_NOTICE_KEY, JSON.stringify(notice));
}

function noticeFromContinuation(
    kind: AuthCodeSessionNotice["kind"],
    continuation: Oid4vciAuthCodeContinuation | null,
): AuthCodeSessionNotice {
    return {
        kind,
        walletId: continuation?.walletId ?? null,
        credentialConfigurationId: continuation?.credentialConfigurationId ?? null,
        at: Date.now(),
    };
}

export function saveAuthCodeContinuation(value: Oid4vciAuthCodeContinuation): void {
    const s = storage();
    if (!s) throw new Error("sessionStorage unavailable — cannot continue authorization_code flow");
    s.removeItem(OID4VCI_AUTH_CODE_NOTICE_KEY);
    s.setItem(OID4VCI_AUTH_CODE_STORAGE_KEY, JSON.stringify(value));
}

/** Inspect pending auth-code session without requiring OAuth `state`. */
export function peekAuthCodeContinuation(): AuthCodeContinuationLookup {
    const s = storage();
    if (!s) return { status: "none" };
    const raw = s.getItem(OID4VCI_AUTH_CODE_STORAGE_KEY);
    if (!raw) return { status: "none" };
    const continuation = parseContinuation(raw);
    if (!continuation) return { status: "invalid" };
    const expiresAt = continuation.createdAt + OID4VCI_AUTH_CODE_TTL_MS;
    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) return { status: "expired", continuation };
    return { status: "pending", continuation, expiresAt, remainingMs };
}

/**
 * Load continuation for the callback. Expired sessions are cleared and recorded
 * as a notice so the wallet home can explain the timeout.
 */
export function resolveAuthCodeContinuation(expectedState?: string): AuthCodeContinuationResolve {
    const peeked = peekAuthCodeContinuation();
    if (peeked.status === "none") return { ok: false, reason: "missing" };
    if (peeked.status === "invalid") {
        clearAuthCodeContinuation();
        return { ok: false, reason: "invalid" };
    }
    if (peeked.status === "expired") {
        saveNotice(noticeFromContinuation("expired", peeked.continuation));
        clearAuthCodeContinuation();
        return { ok: false, reason: "expired" };
    }
    if (expectedState != null && peeked.continuation.state !== expectedState) {
        return { ok: false, reason: "mismatch" };
    }
    return { ok: true, continuation: peeked.continuation };
}

/** @deprecated Prefer {@link resolveAuthCodeContinuation} for distinct error reasons. */
export function loadAuthCodeContinuation(expectedState?: string): Oid4vciAuthCodeContinuation | null {
    const resolved = resolveAuthCodeContinuation(expectedState);
    return resolved.ok ? resolved.continuation : null;
}

export function clearAuthCodeContinuation(): void {
    storage()?.removeItem(OID4VCI_AUTH_CODE_STORAGE_KEY);
}

/** User cancelled waiting for AS login (or UI dismissed an expired session). */
export function cancelAuthCodeContinuation(kind: "cancelled" | "expired" = "cancelled"): void {
    const peeked = peekAuthCodeContinuation();
    const continuation =
        peeked.status === "pending" || peeked.status === "expired" ? peeked.continuation : null;
    saveNotice(noticeFromContinuation(kind, continuation));
    clearAuthCodeContinuation();
}

export function peekAuthCodeNotice(): AuthCodeSessionNotice | null {
    const s = storage();
    if (!s) return null;
    const raw = s.getItem(OID4VCI_AUTH_CODE_NOTICE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as AuthCodeSessionNotice;
    } catch {
        return null;
    }
}

export function clearAuthCodeNotice(): void {
    storage()?.removeItem(OID4VCI_AUTH_CODE_NOTICE_KEY);
}

/**
 * One-shot notice after cancel/timeout.
 * When [walletId] is set, only consume a notice for that wallet (or wallet-less).
 */
export function consumeAuthCodeNotice(walletId?: string | null): AuthCodeSessionNotice | null {
    const notice = peekAuthCodeNotice();
    if (!notice) return null;
    if (walletId && notice.walletId && notice.walletId !== walletId) return null;
    clearAuthCodeNotice();
    return notice;
}

export function formatAuthCodeRemaining(remainingMs: number): string {
    const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    if (m <= 0) return `${s}s`;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function resolveOid4vciClientConfig(runtimeConfig: {
    public: Record<string, unknown>;
}): { clientId: string; redirectUri: string } {
    const clientId =
        String(runtimeConfig.public.oid4vciClientId || "").trim() || "wallet-secdsa-demo";
    const redirectUri =
        String(runtimeConfig.public.oid4vciRedirectUri || "").trim() ||
        `${String(runtimeConfig.public.oidcPublicBaseUrl || "http://localhost:7115").replace(/\/$/, "")}/oid4vci/callback`;
    return { clientId, redirectUri };
}

type AuthorizationUrlResult = {
    authorizationUrl: string;
    state: string;
    codeVerifier?: string | null;
    credentialConfigurationId: string;
    credentialIssuerBaseUrl: string;
    nonceEndpoint?: string | null;
};

type ExchangeCodeResult = {
    accessToken: string;
    expiresIn?: number | null;
};

/**
 * After AS redirect: exchange code → nonce → proof → fetch+store.
 * Caller must unlock SECDSA PIN before calling when proof signing is required.
 */
export async function completeAuthCodeIssuance(opts: {
    walletId: string;
    code: string;
    continuation: Oid4vciAuthCodeContinuation;
    did?: string | null;
}): Promise<void> {
    const { walletId, code, continuation } = opts;
    const did = opts.did ?? continuation.did;

    const token = await $fetch<ExchangeCodeResult>(
        `/wallet-api/wallet/${walletId}/credentials/receive/exchange-code`,
        {
            method: "POST",
            body: {
                code,
                codeVerifier: continuation.codeVerifier,
                credentialIssuerBaseUrl: continuation.credentialIssuerBaseUrl,
                clientId: continuation.clientId,
                redirectUri: continuation.redirectUri,
            },
        },
    );

    let nonce: string | null = null;
    if (continuation.nonceEndpoint || continuation.credentialIssuerBaseUrl) {
        try {
            const nonceResult = await $fetch<{ nonce?: string | null }>(
                `/wallet-api/wallet/${walletId}/credentials/receive/request-nonce`,
                {
                    method: "POST",
                    body: {
                        credentialIssuer: continuation.credentialIssuerBaseUrl,
                    },
                },
            );
            nonce = nonceResult.nonce ?? null;
        } catch (e) {
            console.warn("request-nonce failed; continuing without nonce", e);
        }
    }

    // SECDSA SoftHSM must already be unlocked; do not swallow sign failures —
    // continuing without a proof only yields a confusing issuer invalid_proof.
    const proof = await $fetch<{ proofJwt: string }>(
        `/wallet-api/wallet/${walletId}/credentials/receive/sign-proof`,
        {
            method: "POST",
            body: {
                issuerUrl: continuation.credentialIssuerBaseUrl,
                nonce,
                did,
                // Auth-code proofs need iss=client_id (eduID / OID4VCI); pre-auth may omit.
                clientId: continuation.clientId,
            },
        },
    );
    const proofJwt = proof.proofJwt;

    await $fetch(`/wallet-api/wallet/${walletId}/credentials/receive/fetch-credential`, {
        method: "POST",
        body: {
            credentialEndpoint: continuation.credentialEndpoint,
            accessToken: token.accessToken,
            credentialConfigurationId: continuation.credentialConfigurationId,
            proofJwt,
            clientId: continuation.clientId,
            storeInWallet: true,
        },
    });
}

/** Ensure authorize URL has an OIDC scope (default openid). Does not remove authorization_details. */
export function ensureOpenIdScope(authorizationUrl: string, scope = "openid"): string {
    try {
        const url = new URL(authorizationUrl);
        if (!url.searchParams.get("scope")?.trim()) {
            url.searchParams.set("scope", scope);
        }
        return url.toString();
    } catch {
        return authorizationUrl;
    }
}

/**
 * Offer/metadata URLs use host.docker.internal so wallet-api2 can fetch them.
 * The browser must use localhost (published Caddy ports) or the authorize hop
 * stalls and never reaches /external_login → ISSUER_AS_*.
 */
export function toBrowserReachableUrl(url: string): string {
    try {
        const parsed = new URL(url);
        if (parsed.hostname === "host.docker.internal") {
            parsed.hostname = "localhost";
            return parsed.toString();
        }
        return url;
    } catch {
        return url
            .replace("://host.docker.internal:", "://localhost:")
            .replace("://host.docker.internal/", "://localhost/");
    }
}

export async function startAuthCodeRedirect(opts: {
    walletId: string;
    offerUrl: string;
    did: string | null;
    clientId: string;
    redirectUri: string;
    credentialEndpoint: string;
    nonceEndpoint?: string | null;
    /** OAuth scope for the authorize request (default openid). */
    scope?: string;
}): Promise<never> {
    const result = await $fetch<AuthorizationUrlResult>(
        `/wallet-api/wallet/${opts.walletId}/credentials/receive/authorization-url`,
        {
            method: "POST",
            body: {
                offerUrl: opts.offerUrl,
                clientId: opts.clientId,
                redirectUri: opts.redirectUri,
                usePkce: true,
            },
        },
    );

    let authorizationUrl =
        typeof result.authorizationUrl === "string"
            ? result.authorizationUrl
            : String(result.authorizationUrl);

    // wallet-api2 often omits `scope`. Some ASs then substitute the client's
    // registered scopes (e.g. wallet:read from demo templates), which eduID rejects.
    // OID4VCI selects the credential via authorization_details; OIDC needs openid.
    authorizationUrl = ensureOpenIdScope(authorizationUrl, opts.scope);
    authorizationUrl = toBrowserReachableUrl(authorizationUrl);

    saveAuthCodeContinuation({
        state: result.state,
        codeVerifier: result.codeVerifier ?? null,
        credentialIssuerBaseUrl: result.credentialIssuerBaseUrl,
        credentialConfigurationId: result.credentialConfigurationId,
        credentialEndpoint: opts.credentialEndpoint,
        nonceEndpoint: result.nonceEndpoint
            ? String(result.nonceEndpoint)
            : (opts.nonceEndpoint ?? null),
        walletId: opts.walletId,
        did: opts.did,
        clientId: opts.clientId,
        redirectUri: opts.redirectUri,
        offerUrl: opts.offerUrl,
        createdAt: Date.now(),
    });

    window.location.assign(authorizationUrl);
    // Unreachable — keep TypeScript happy for callers that await.
    return new Promise(() => undefined) as Promise<never>;
}
