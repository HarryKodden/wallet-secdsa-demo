package nl.harrykodden.secdsa.waltid.client

import java.util.concurrent.ConcurrentHashMap

/**
 * Process-memory PIN session for SECDSA WSCA accounts.
 *
 * The wallet frontend collects the PIN and calls unlock; the wallet backend
 * stores it here only for the process lifetime so subsequent GENKEY/SIGN can
 * reach WSCA. Never log or persist these values.
 *
 * Lab-only; not a substitute for a hardware-bound unlock UX.
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
}
