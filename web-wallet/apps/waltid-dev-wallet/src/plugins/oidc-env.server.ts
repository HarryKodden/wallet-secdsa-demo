/**
 * Apply OIDC_* / related env vars onto Nuxt runtimeConfig at server start
 * so browser-facing public config matches the process environment.
 */
import {resolveOidcEnv} from "../server/utils/oidcEnv";

export default defineNuxtPlugin(() => {
    const env = resolveOidcEnv();
    const config = useRuntimeConfig();

    config.oidcTokenUrl = env.tokenUrl;
    config.oidcClientSecret = env.clientSecret;
    config.public.oidcAuthorizeUrl = env.authorizeUrl;
    config.public.oidcClientId = env.clientId;
    config.public.oidcRedirectUri = env.redirectUri;
    config.public.oidcPublicBaseUrl = env.baseUrl;
    config.public.oidcScopes = env.scopes;
    config.public.oid4vciClientId = env.oid4vciClientId;
    config.public.oid4vciRedirectUri = env.oid4vciRedirectUri;

    const wsca =
        process.env.WSCA_INTERNAL_URL?.trim() ||
        process.env.WSCA_BASE_URL?.trim() ||
        "";
    if (wsca) config.public.wscaBaseUrl = wsca;

    const accountId = process.env.WSCA_ACCOUNT_ID?.trim();
    if (accountId) config.public.wscaAccountId = accountId;

    const api2 = process.env.WALLET2_PUBLIC_BASE_URL?.trim();
    if (api2) config.public.walletApi2PublicBaseUrl = api2;

    const verifierPrefix =
        process.env.VERIFIER_PUBLIC_URL_PREFIX?.trim() ||
        process.env.WALLET_VERIFIER_PUBLIC_URL_PREFIX?.trim() ||
        "";
    if (verifierPrefix) config.public.verifierPublicUrlPrefix = verifierPrefix;

    const appVersion = process.env.APP_VERSION?.trim();
    if (appVersion) config.public.appVersion = appVersion;
});
