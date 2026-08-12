package nl.harrykodden.secdsa.waltid.config

/**
 * Connection settings for the SECDSA trust layer.
 *
 * Educational / research only — see HarryKodden/SECDSA USAGE.md.
 */
data class WscaConfig(
    val baseUrl: String = System.getenv("WSCA_BASE_URL") ?: "http://127.0.0.1:8080",
    val accountId: String = System.getenv("WSCA_ACCOUNT_ID") ?: "citizen-42",
    /** Demo PIN held only after [nl.harrykodden.secdsa.waltid.client.WscaClient.unlock]. */
    val pinEnvFallback: String? = System.getenv("WSCA_PIN"),
) {
    fun normalizedBaseUrl(): String = baseUrl.trimEnd('/')
}
