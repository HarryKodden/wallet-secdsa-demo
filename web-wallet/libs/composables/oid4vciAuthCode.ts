/**
 * OID4VCI authorization_code grant helpers for the demo web wallet.
 *
 * Persists OAuth `state` + PKCE `code_verifier` (and issuance context) in
 * sessionStorage across the AS redirect. `issuer_state` from the offer is
 * handled by wallet-api2 when building the authorization URL — do not confuse
 * it with this OAuth `state`.
 */

export const OID4VCI_AUTH_CODE_STORAGE_KEY = "oid4vci.authCode.continuation";
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

function storage(): Storage | null {
    if (!import.meta.client) return null;
    try {
        return sessionStorage;
    } catch {
        return null;
    }
}

export function saveAuthCodeContinuation(value: Oid4vciAuthCodeContinuation): void {
    const s = storage();
    if (!s) throw new Error("sessionStorage unavailable — cannot continue authorization_code flow");
    s.setItem(OID4VCI_AUTH_CODE_STORAGE_KEY, JSON.stringify(value));
}

export function loadAuthCodeContinuation(expectedState?: string): Oid4vciAuthCodeContinuation | null {
    const s = storage();
    if (!s) return null;
    const raw = s.getItem(OID4VCI_AUTH_CODE_STORAGE_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Oid4vciAuthCodeContinuation;
        if (!parsed?.state || !parsed.credentialIssuerBaseUrl || !parsed.walletId) return null;
        if (Date.now() - parsed.createdAt > OID4VCI_AUTH_CODE_TTL_MS) {
            clearAuthCodeContinuation();
            return null;
        }
        if (expectedState != null && parsed.state !== expectedState) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function clearAuthCodeContinuation(): void {
    storage()?.removeItem(OID4VCI_AUTH_CODE_STORAGE_KEY);
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

    let proofJwt: string | undefined;
    try {
        const proof = await $fetch<{ proofJwt: string }>(
            `/wallet-api/wallet/${walletId}/credentials/receive/sign-proof`,
            {
                method: "POST",
                body: {
                    issuerUrl: continuation.credentialIssuerBaseUrl,
                    nonce,
                    did,
                },
            },
        );
        proofJwt = proof.proofJwt;
    } catch (e) {
        console.warn("sign-proof failed; retrying fetch without proof", e);
    }

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
