package id.walt.wallet2.solecontrol

import nl.harrykodden.secdsa.waltid.client.SecdsaPinSession

/**
 * Enforces SignGrant consumption when [SoleControlSigning.enabled].
 *
 * On consume, installs the grant-bound SoftHSM PIN into [SecdsaPinSession] for
 * the duration of the receive/present request. Callers must [SignGrantSession.release]
 * in a `finally` block so the PIN does not remain for unrestricted SIGN.
 */
object SignGrantGuard {

    /**
     * No-op session when sole-control is off (legacy PIN session unchanged).
     * When on: requires a valid single-use grant matching wallet, key, purpose,
     * and optional soft binding; installs grant PIN for subsequent lab SIGN.
     */
    fun requireConsumed(
        signGrant: String?,
        walletId: String,
        keyId: String,
        purpose: SignGrantPurpose,
        expectedBinding: SignGrantBinding? = null,
    ): SignGrantSession {
        if (!SoleControlSigning.enabled()) return SignGrantSession.NoOp

        if (signGrant.isNullOrBlank()) {
            SoleControlAudit.grantDenied(walletId, purpose, "sign_grant_required")
            throw SignGrantException(
                error = "sign_grant_required",
                description =
                    "SignGrant required when SOLE_CONTROL_SIGNING=true. " +
                        "POST /wallet/{id}/keys/secdsa/authorize-sign first " +
                        "(see docs/sole-control-track-a.md).",
            )
        }
        val grant = try {
            SignGrantStore.consume(
                signGrant = signGrant,
                walletId = walletId,
                keyId = keyId,
                purpose = purpose,
                expectedBinding = expectedBinding,
            )
        } catch (e: IllegalStateException) {
            SoleControlAudit.grantDenied(walletId, purpose, e.message ?: "invalid_or_expired")
            throw SignGrantException(
                error = "sign_grant_invalid_or_expired",
                description = e.message ?: "SignGrant invalid or expired",
            )
        } catch (e: IllegalArgumentException) {
            SoleControlAudit.grantDenied(walletId, purpose, e.message ?: "rejected")
            throw SignGrantException(
                error = "sign_grant_invalid_or_expired",
                description = e.message ?: "SignGrant rejected",
            )
        }

        val pin = grant.pin
        if (pin.isNullOrBlank()) {
            SoleControlAudit.grantDenied(walletId, purpose, "missing_grant_pin")
            throw SignGrantException(
                error = "sign_grant_invalid_or_expired",
                description = "SignGrant has no SoftHSM PIN (re-mint via authorize-sign)",
            )
        }
        SecdsaPinSession.unlock(grant.accountId, pin)
        SoleControlAudit.grantConsumed(
            walletId = walletId,
            accountId = grant.accountId,
            keyId = grant.keyId,
            purpose = purpose,
            grantId = grant.id,
        )
        return SignGrantSession.Active(grant.accountId)
    }
}

/**
 * Holds the grant-scoped PIN session for one holder SIGN request.
 * Always [release] in `finally` when sole-control is on.
 */
sealed class SignGrantSession {
    abstract fun release()

    data object NoOp : SignGrantSession() {
        override fun release() = Unit
    }

    class Active(private val accountId: String) : SignGrantSession() {
        override fun release() {
            SecdsaPinSession.clear(accountId)
        }
    }
}

class SignGrantException(
    val error: String,
    val description: String,
) : IllegalArgumentException(description)
