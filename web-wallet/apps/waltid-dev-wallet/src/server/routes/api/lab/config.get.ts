import {
    isIssuerLabConfigured,
    isVerifierLabConfigured,
} from "../../../utils/labApis";
import {resolveOidcEnv} from "../../../utils/oidcEnv";

/**
 * Lab AS / auth-code configuration (non-secret) for the Scan Lab UI.
 *
 * Issuer / verifier Lab panels are shown only when
 * ISSUER_API2_INTERNAL_URL / VERIFIER_API2_INTERNAL_URL are set.
 *
 * Issuer user-login AS (ISSUER_AS_*) is separate from the wallet OID4VCI client
 * (OID4VCI_CLIENT_ID / redirect). See .env.example.
 */
export default defineEventHandler(() => {
    const config = useRuntimeConfig();
    const oidcEnv = resolveOidcEnv();
    const authorizeUrl = String(
        process.env.ISSUER_AS_AUTHORIZE_URL || config.public.issuerAsAuthorizeUrl || "",
    ).trim();
    const tokenUrl = String(
        process.env.ISSUER_AS_TOKEN_URL || config.public.issuerAsTokenUrl || "",
    ).trim();
    const issuerAsClientId = String(
        process.env.ISSUER_AS_CLIENT_ID || config.public.issuerAsClientId || "",
    ).trim();
    const flag = String(
        process.env.LAB_ENABLE_AUTH_CODE || config.public.labEnableAuthCode || "",
    )
        .trim()
        .toLowerCase();

    const demoKeycloak =
        authorizeUrl.includes("keycloak.demo.walt.id") || !authorizeUrl;
    const explicitlyEnabled = flag === "true" || flag === "1" || flag === "yes";
    const explicitlyDisabled = flag === "false" || flag === "0" || flag === "no";

    // Offer auth-code in Lab when enabled, or when a non-demo AS URL is configured.
    const authCodeEnabled =
        !explicitlyDisabled &&
        (explicitlyEnabled || (Boolean(authorizeUrl) && !demoKeycloak));

    const issuerConfigured = isIssuerLabConfigured();
    const verifierConfigured = isVerifierLabConfigured();

    return {
        issuerConfigured,
        verifierConfigured,
        enabled: issuerConfigured || verifierConfigured,
        authCodeEnabled: issuerConfigured && authCodeEnabled,
        issuerAs: {
            authorizeUrl: authorizeUrl || null,
            tokenUrl: tokenUrl || null,
            clientId: issuerAsClientId || null,
            isDemoDefault: demoKeycloak,
        },
        oid4vci: {
            // Live env (OIDC_BASE_URL / OID4VCI_REDIRECT_URI) — not bake-time localhost.
            clientId: oidcEnv.oid4vciClientId || String(config.public.oid4vciClientId || ""),
            redirectUri: oidcEnv.oid4vciRedirectUri || String(config.public.oid4vciRedirectUri || ""),
        },
    };
});
