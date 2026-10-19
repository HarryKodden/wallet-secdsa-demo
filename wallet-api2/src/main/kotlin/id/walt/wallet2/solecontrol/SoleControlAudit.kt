package id.walt.wallet2.solecontrol

import id.walt.wallet2.server.events.Wallet2EventLog
import id.walt.wallet2.server.events.eventData
import io.github.oshai.kotlinlogging.KotlinLogging

/**
 * Redacted audit trail for Track G sole-control actions.
 * Never logs PIN, grant opaque ids in full, or SoftHSM secrets.
 */
object SoleControlAudit {
    private val log = KotlinLogging.logger {}

    fun authorizeMinted(
        walletId: String,
        accountId: String,
        keyId: String,
        purpose: SignGrantPurpose,
        grantId: String,
    ) {
        val grantPrefix = redactId(grantId)
        log.info {
            "solecontrol.authorize_sign minted wallet=$walletId account=${redactAccount(accountId)} " +
                "key=${redactKey(keyId)} purpose=${purpose.name} grant=$grantPrefix"
        }
        Wallet2EventLog.append(
            walletId = walletId,
            event = "SoleControl",
            action = "authorize_sign",
            data = eventData(
                "outcome" to "minted",
                "purpose" to purpose.name,
                "keyId" to redactKey(keyId),
                "accountId" to redactAccount(accountId),
                "grant" to grantPrefix,
            ),
        )
    }

    fun authorizePinFailed(walletId: String, accountId: String) {
        log.warn {
            "solecontrol.authorize_sign pin_fail wallet=$walletId account=${redactAccount(accountId)}"
        }
        Wallet2EventLog.append(
            walletId = walletId,
            event = "SoleControl",
            action = "authorize_sign",
            data = eventData(
                "outcome" to "pin_fail",
                "accountId" to redactAccount(accountId),
            ),
        )
    }

    fun authorizeRateLimited(walletId: String, accountId: String) {
        log.warn {
            "solecontrol.authorize_sign rate_limited wallet=$walletId account=${redactAccount(accountId)}"
        }
        Wallet2EventLog.append(
            walletId = walletId,
            event = "SoleControl",
            action = "authorize_sign",
            data = eventData(
                "outcome" to "rate_limited",
                "accountId" to redactAccount(accountId),
            ),
        )
    }

    fun grantConsumed(
        walletId: String,
        accountId: String,
        keyId: String,
        purpose: SignGrantPurpose,
        grantId: String,
    ) {
        val grantPrefix = redactId(grantId)
        log.info {
            "solecontrol.grant_consumed wallet=$walletId account=${redactAccount(accountId)} " +
                "key=${redactKey(keyId)} purpose=${purpose.name} grant=$grantPrefix"
        }
        Wallet2EventLog.append(
            walletId = walletId,
            event = "SoleControl",
            action = "grant_consumed",
            data = eventData(
                "purpose" to purpose.name,
                "keyId" to redactKey(keyId),
                "accountId" to redactAccount(accountId),
                "grant" to grantPrefix,
            ),
        )
    }

    fun grantDenied(walletId: String, purpose: SignGrantPurpose, reason: String) {
        log.warn {
            "solecontrol.grant_denied wallet=$walletId purpose=${purpose.name} reason=$reason"
        }
        Wallet2EventLog.append(
            walletId = walletId,
            event = "SoleControl",
            action = "grant_denied",
            data = eventData(
                "purpose" to purpose.name,
                "reason" to reason.take(80),
            ),
        )
    }

    fun unlockSessionCleared(walletId: String, accountId: String) {
        log.info {
            "solecontrol.unlock_cleared wallet=$walletId account=${redactAccount(accountId)} " +
                "(sole-control: no PIN-forever session)"
        }
    }

    /** First 8 chars of opaque id + ellipsis — enough for support correlation. */
    fun redactId(raw: String): String {
        val t = raw.trim()
        if (t.length <= 8) return "***"
        return t.take(8) + "…"
    }

    fun redactAccount(accountId: String): String {
        val t = accountId.trim()
        if (t.length <= 4) return "***"
        return t.take(2) + "…" + t.takeLast(2)
    }

    fun redactKey(keyId: String): String {
        val t = keyId.trim()
        if (t.length <= 12) return "secdsa:…"
        return t.take(8) + "…" + t.takeLast(4)
    }
}
