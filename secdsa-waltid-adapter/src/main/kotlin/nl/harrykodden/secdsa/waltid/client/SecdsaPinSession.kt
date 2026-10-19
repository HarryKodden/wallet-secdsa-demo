package nl.harrykodden.secdsa.waltid.client

import java.util.concurrent.ConcurrentHashMap

/**
 * Process-memory PIN session for SECDSA WSCA accounts.
 *
 * **Legacy / demo path.** The wallet frontend collects the PIN and calls unlock;
 * the wallet backend stores it for the process lifetime so subsequent GENKEY/SIGN
 * can reach WSCA. Never log or persist these values.
 *
 * Track G (sole-control): prefer [id.walt.wallet2.solecontrol.SignGrantStore] via
 * `POST …/keys/secdsa/authorize-sign`. When `SOLE_CONTROL_SIGNING=true`, unlock
 * alone must not authorize arbitrary holder SIGN — see
 * `docs/sole-control-track-a.md`.
 */
object SecdsaPinSession {
    private val pinsByAccountId = ConcurrentHashMap<String, String>()

    fun unlock(accountId: String, pin: String) {
        require(accountId.isNotBlank()) { "accountId required" }
        require(pin.length >= 4) { "PIN must be at least 4 characters" }
        pinsByAccountId[accountId] = pin
    }

    fun clear(accountId: String) {
        pinsByAccountId.remove(accountId)
    }

    fun clearAll() {
        pinsByAccountId.clear()
    }

    fun get(accountId: String): String? = pinsByAccountId[accountId]

    /** True when a PIN was unlocked for this account in the current process. */
    fun isUnlocked(accountId: String): Boolean =
        accountId.isNotBlank() && pinsByAccountId.containsKey(accountId)
}
