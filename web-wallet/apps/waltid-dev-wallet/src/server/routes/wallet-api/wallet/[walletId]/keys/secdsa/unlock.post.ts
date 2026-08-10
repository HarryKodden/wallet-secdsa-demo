import {createError, defineEventHandler, readBody} from "h3";
import {useRuntimeConfig} from "#imports";

/**
 * POST /wallet-api/wallet/:walletId/keys/secdsa/unlock
 *
 * Validates the user-supplied PIN against the SECDSA service for the given
 * accountId and activates (or re-activates) that account's slot.
 *
 * SECDSA API is session/selection-based:
 *   1. POST /api/wallets/add   {id}   — ensure the wallet account exists (idempotent)
 *   2. POST /api/wallets/select {id}  — make it the "current" account
 *   3. POST /api/activate {pin}       — Protocol 4: first call provisions + activates;
 *                                       subsequent calls re-activate the session.
 *      "already activated" response = success (session already open).
 *
 * This route takes precedence over the catch-all wallet-api2 proxy because
 * Nitro matches more-specific paths first.
 */
export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig(event);
    const wscaBaseUrl: string =
        (config.public as {wscaBaseUrl?: string}).wscaBaseUrl ||
        "http://secdsa:8080";

    const body = (await readBody(event).catch(() => null)) ?? {};
    const {accountId, pin, mode = "unlock"} = body as {
        accountId?: string;
        pin?: string;
        mode?: "setup" | "unlock";
    };

    if (!pin || pin.length < 4) {
        throw createError({statusCode: 400, statusMessage: "PIN must be at least 4 characters"});
    }
    if (!accountId) {
        throw createError({statusCode: 400, statusMessage: "accountId is required"});
    }

    if (mode === "setup" && !/^\d{4,}$/.test(pin)) {
        throw createError({statusCode: 400, statusMessage: "PIN must be numeric digits (min 4)"});
    }

    // -------------------------------------------------------------------------
    // Call SECDSA using the correct stateful API:
    //   step 1 — ensure account exists (idempotent)
    //   step 2 — select it as the active account
    //   step 3 — run Protocol 4 activation with the supplied PIN
    // -------------------------------------------------------------------------
    try {
        // Step 1: add (no-op if already present)
        await fetch(`${wscaBaseUrl}/api/wallets/add`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({id: accountId}),
        }).catch(() => {/* ignore — failure means it already exists */});

        // Step 2: select
        const selectRes = await fetch(`${wscaBaseUrl}/api/wallets/select`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({id: accountId}),
        });
        if (!selectRes.ok) {
            throw createError({statusCode: 502, statusMessage: "SECDSA: account selection failed"});
        }

        // Step 3: activate (Protocol 4)
        const activateRes = await fetch(`${wscaBaseUrl}/api/activate`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({pin}),
        });
        const activateBody = await activateRes.json().catch(() => ({}));
        const errMsg = (activateBody as {error?: string})?.error ?? "";

        if (activateRes.ok || /already.?activ/i.test(errMsg)) {
            return {ok: true, wsca: "activated"};
        }

        // PIN-blocked — surface the exact message
        if (/block/i.test(errMsg)) {
            throw createError({statusCode: 401, statusMessage: errMsg});
        }

        // In setup mode, a non-fatal SECDSA error defers activation to GENKEY
        if (mode === "setup") {
            console.info(`[unlock/setup] SECDSA activate deferred (${activateRes.status}: ${errMsg})`);
            return {ok: true, wsca: "pending"};
        }

        // Unlock mode: wrong PIN → 401 so the modal shows the error
        throw createError({
            statusCode: 401,
            statusMessage: errMsg || "Incorrect PIN",
        });

    } catch (err: any) {
        // Re-throw known H3 errors (our own createError calls above)
        if (err?.statusCode) throw err;
        throw createError({statusCode: 502, statusMessage: "SECDSA service unavailable"});
    }
});
