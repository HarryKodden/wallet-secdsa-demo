package id.walt.wallet2.solecontrol

import java.util.concurrent.ConcurrentHashMap

/**
 * Simple in-process rate limits for sole-control sensitive actions (lab).
 * Not a substitute for edge/WAF limits in production.
 */
object SoleControlRateLimit {
    /** Max authorize-sign attempts per account per window. */
    var authorizeMax: Int =
        System.getenv("SOLE_CONTROL_AUTHORIZE_RATE_MAX")?.toIntOrNull()?.coerceIn(5, 500) ?: 30

    /** Max SoftHSM PIN failures per account per window. */
    var pinFailMax: Int =
        System.getenv("SOLE_CONTROL_PIN_FAIL_RATE_MAX")?.toIntOrNull()?.coerceIn(3, 100) ?: 10

    /** Sliding window length (ms). */
    var windowMs: Long =
        System.getenv("SOLE_CONTROL_RATE_WINDOW_MS")?.toLongOrNull()?.coerceIn(30_000L, 3_600_000L)
            ?: 300_000L

    private val authorizeHits = ConcurrentHashMap<String, MutableList<Long>>()
    private val pinFailHits = ConcurrentHashMap<String, MutableList<Long>>()

    fun allowAuthorize(accountId: String): Boolean =
        allow(authorizeHits, accountId, authorizeMax)

    fun recordAuthorize(accountId: String) {
        record(authorizeHits, accountId)
    }

    fun allowPinAttempt(accountId: String): Boolean =
        allow(pinFailHits, accountId, pinFailMax)

    fun recordPinFail(accountId: String) {
        record(pinFailHits, accountId)
    }

    /** Test helper. */
    fun clearAll() {
        authorizeHits.clear()
        pinFailHits.clear()
    }

    private fun allow(map: ConcurrentHashMap<String, MutableList<Long>>, key: String, max: Int): Boolean {
        val now = System.currentTimeMillis()
        val list = map.getOrPut(key) { mutableListOf() }
        synchronized(list) {
            list.removeAll { now - it > windowMs }
            return list.size < max
        }
    }

    private fun record(map: ConcurrentHashMap<String, MutableList<Long>>, key: String) {
        val now = System.currentTimeMillis()
        val list = map.getOrPut(key) { mutableListOf() }
        synchronized(list) {
            list.removeAll { now - it > windowMs }
            list.add(now)
        }
    }
}
