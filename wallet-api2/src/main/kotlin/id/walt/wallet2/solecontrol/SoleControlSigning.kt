package id.walt.wallet2.solecontrol

/**
 * Track G / P3-SC feature flag.
 *
 * When enabled, holder SIGN must be authorized via [SignGrantStore] (see
 * `docs/sole-control-track-a.md`). When disabled, legacy [nl.harrykodden.secdsa.waltid.client.SecdsaPinSession]
 * unlock remains sufficient (demo default).
 */
object SoleControlSigning {
    fun enabled(): Boolean =
        System.getenv("SOLE_CONTROL_SIGNING")
            ?.trim()
            ?.equals("true", ignoreCase = true) == true

    /** Default SignGrant lifetime (G0 freeze). */
    const val DEFAULT_GRANT_TTL_SECONDS: Long = 180L
}
