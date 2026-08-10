import {createError, defineEventHandler, readBody} from "h3";
import {useRuntimeConfig} from "#imports";

/**
 * POST /wallet-api/wallet/:walletId/keys/secdsa/unlock
 *
 * SoftHSM PIN gate (shared by web + mobile via Nitro):
 *   1. POST /api/wallets/add    — ensure account exists
 *   2. POST /api/wallets/select — select account; read `activated`
 *   3a. Not activated → POST /api/activate {pin}  (Protocol 4 — locks PIN to account)
 *   3b. Already activated → POST /api/instruct {pin, op:ECHO} to verify PIN
 *
 * SoftHSM quirk: /api/activate on an already-activated account returns
 * "already activated" for ANY pin (including wrong ones). Never treat that as
 * PIN proof — always verify with /api/instruct when activated.
 *
 * mode "setup" is only allowed when SoftHSM reports activated=false.
 * mode "unlock" always requires SoftHSM to accept the PIN.
 */

type SecdsaState = {
    activated?: boolean;
    error?: string;
    accounts?: Array<{id?: string; activated?: boolean; active?: boolean}>;
    wsca?: {blocked?: boolean};
};

async function secdsaJson(url: string, body: unknown): Promise<{ok: boolean; status: number; data: SecdsaState}> {
    const res = await fetch(url, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as SecdsaState;
    return {ok: res.ok, status: res.status, data};
}

function errText(data: SecdsaState): string {
    return (data.error ?? "").toString();
}

function isWrongPin(msg: string): boolean {
    return /wrong\s*pin|incorrect\s*pin|not activated with this pin|message authentication failed/i.test(msg);
}

function isBlocked(msg: string, data: SecdsaState): boolean {
    return /block/i.test(msg) || data.wsca?.blocked === true;
}

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
    if (!/^\d{4,}$/.test(pin)) {
        throw createError({statusCode: 400, statusMessage: "PIN must be numeric digits (min 4)"});
    }

    try {
        // Step 1: ensure account exists
        await fetch(`${wscaBaseUrl}/api/wallets/add`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({id: accountId}),
        }).catch(() => {/* ignore — may already exist */});

        // Step 2: select + read activation state
        const select = await secdsaJson(`${wscaBaseUrl}/api/wallets/select`, {id: accountId});
        if (!select.ok && !select.data.accounts) {
            throw createError({statusCode: 502, statusMessage: "SECDSA: account selection failed"});
        }

        const accountRow = select.data.accounts?.find((a) => a.id === accountId);
        const activated = accountRow?.activated === true || select.data.activated === true;

        // Setup is only for first Protocol 4 activation — never overwrite an existing PIN.
        if (mode === "setup" && activated) {
            throw createError({
                statusCode: 409,
                statusMessage:
                    "SoftHSM account already activated — PIN is locked. Enter the existing PIN (unlock), do not choose a new one.",
            });
        }

        if (!activated) {
            // Step 3a: Protocol 4 — first activate locks PIN to this account
            const activate = await secdsaJson(`${wscaBaseUrl}/api/activate`, {pin});
            const msg = errText(activate.data);

            if (activate.ok && !msg) {
                return {ok: true, wsca: "activated", mode: "setup"};
            }
            // Race: another client activated between select and activate
            if (/already.?activ/i.test(msg)) {
                // Fall through to instruct verification with the supplied PIN
            } else if (isBlocked(msg, activate.data)) {
                throw createError({statusCode: 401, statusMessage: msg || "SoftHSM wallet blocked"});
            } else if (isWrongPin(msg) || !activate.ok) {
                throw createError({
                    statusCode: 401,
                    statusMessage: msg || "Incorrect PIN",
                });
            } else {
                throw createError({statusCode: 401, statusMessage: msg || "SECDSA activation failed"});
            }
        }

        // Step 3b: account already activated — verify PIN via instruct (ECHO).
        // /api/activate returns "already activated" for ANY pin; it is not a PIN check.
        const verify = await secdsaJson(`${wscaBaseUrl}/api/instruct`, {
            pin,
            op: "ECHO",
            data: "pin-check",
        });
        const vMsg = errText(verify.data);

        if (verify.ok && !vMsg) {
            return {ok: true, wsca: "activated", mode: "unlock"};
        }
        if (isBlocked(vMsg, verify.data)) {
            throw createError({statusCode: 401, statusMessage: vMsg || "SoftHSM wallet blocked"});
        }
        throw createError({
            statusCode: 401,
            statusMessage: isWrongPin(vMsg) ? "Incorrect PIN" : (vMsg || "Incorrect PIN"),
        });
    } catch (err: any) {
        if (err?.statusCode) throw err;
        throw createError({statusCode: 502, statusMessage: "SECDSA service unavailable"});
    }
});
