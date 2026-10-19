package nl.harrykodden.secdsa.waltid.client

import java.util.concurrent.ConcurrentHashMap

/**
 * Process-memory PIN session for SECDSA WSCA accounts.
 *
 * **Legacy / demo path** when `SOLE_CONTROL_SIGNING` is off: unlock stores PIN so
 * subsequent GENKEY/SIGN can reach WSCA for the process lifetime.
 *
 * **Sole-control Track A** (`SOLE_CONTROL_SIGNING=true`): do **not** treat this as
 * holder authorization. Prefer SignGrant (`POST …/keys/secdsa/authorize-sign`);
 * wallet-api2 may briefly install a grant-scoped PIN here for one receive/present
 * request, then clear. See `docs/sole-control-track-a.md` and
 * `secdsa-waltid-adapter/docs/ADAPTER.md` (SignGrant model).
 *
 * Never log or persist these values.
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
