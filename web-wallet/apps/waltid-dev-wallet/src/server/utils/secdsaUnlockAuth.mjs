/**
 * Pure helpers for SECDSA unlock → wallet-api2 PIN session sync.
 * Kept free of h3 so Node can unit-test the mobile vs web auth policy.
 */

/**
 * @param {object} input
 * @param {string | null | undefined} input.authorizationHeader
 * @param {string | null | undefined} input.ktorAuthnzHeader
 * @param {string | null | undefined} input.cookieToken
 * @returns {string | null} Authorization header value (with Bearer) or null
 */
export function resolveWalletApi2UnlockAuthorization(input) {
    const inbound = (input.authorizationHeader || input.ktorAuthnzHeader || "").trim();
    if (inbound) {
        return inbound.toLowerCase().startsWith("bearer ")
            ? inbound
            : `Bearer ${inbound}`;
    }
    const cookie = (input.cookieToken || "").trim();
    if (cookie) {
        return `Bearer ${cookie}`;
    }
    return null;
}

/**
 * SoftHSM unlock always succeeds on a valid PIN. wallet-api2 sync is best-effort:
 * - no auth → skip (paired mobile fills SecdsaPinSession via direct wallet-api2 call)
 * - auth present → attempt sync; caller soft-fails on HTTP errors
 *
 * @param {string | null} authorization
 * @returns {{ attempt: boolean, authorization: string | null }}
 */
export function decideWalletApi2UnlockSync(authorization) {
    if (!authorization) {
        return { attempt: false, authorization: null };
    }
    return { attempt: true, authorization };
}
