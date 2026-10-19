package id.walt.wallet2.solecontrol

/**
 * Enforces SignGrant consumption when [SoleControlSigning.enabled].
 */
object SignGrantGuard {

    /**
     * No-op when sole-control is off.
     * When on: requires a valid single-use grant matching wallet, key, and purpose.
     */
    fun requireConsumed(
        signGrant: String?,
        walletId: String,
        keyId: String,
        purpose: SignGrantPurpose,
    ) {
        if (!SoleControlSigning.enabled()) return
        if (signGrant.isNullOrBlank()) {
            throw SignGrantException(
                error = "sign_grant_required",
                description =
                    "SignGrant required when SOLE_CONTROL_SIGNING=true. " +
                        "POST /wallet/{id}/keys/secdsa/authorize-sign first " +
                        "(see docs/sole-control-track-a.md).",
            )
        }
        try {
            SignGrantStore.consume(
                signGrant = signGrant,
                walletId = walletId,
                keyId = keyId,
                purpose = purpose,
            )
        } catch (e: IllegalStateException) {
            throw SignGrantException(
                error = "sign_grant_invalid_or_expired",
                description = e.message ?: "SignGrant invalid or expired",
            )
        } catch (e: IllegalArgumentException) {
            throw SignGrantException(
                error = "sign_grant_invalid_or_expired",
                description = e.message ?: "SignGrant rejected",
            )
        }
    }
}

class SignGrantException(
    val error: String,
    val description: String,
) : IllegalArgumentException(description)
