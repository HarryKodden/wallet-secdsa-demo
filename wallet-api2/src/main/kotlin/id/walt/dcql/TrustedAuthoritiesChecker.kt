package id.walt.dcql

import id.walt.dcql.models.TrustedAuthoritiesQuery
import id.walt.dcql.models.TrustedAuthorityType
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.serialization.json.*

/**
 * Enforces DCQL `trusted_authorities` against credential issuer identifiers.
 *
 * Fail-closed for authority types we cannot evaluate (e.g. ETSI TL without a
 * trust-list client). DIIP demos typically put issuer DIDs / entity IDs in
 * `openid_federation` values — those are matched to JWT `iss` / W3C `issuer`.
 */
object TrustedAuthoritiesChecker {

    private val log = KotlinLogging.logger {}

    fun matches(
        credential: DcqlCredential,
        authoritiesQuery: List<TrustedAuthoritiesQuery>,
    ): Boolean {
        if (authoritiesQuery.isEmpty()) return true
        val ok = authoritiesQuery.any { query -> matchesOne(credential, query) }
        if (!ok) {
            log.debug {
                "Credential ${credential.id} rejected by trusted_authorities " +
                    "(issuers=${extractIssuerIdentifiers(credential.data)}; " +
                    "query=$authoritiesQuery)"
            }
        }
        return ok
    }

    private fun matchesOne(
        credential: DcqlCredential,
        query: TrustedAuthoritiesQuery,
    ): Boolean {
        val issuers = extractIssuerIdentifiers(credential.data)
        val values = query.values.map { it.trim() }.filter { it.isNotEmpty() }
        if (values.isEmpty()) return false

        val issuerAllowHit = values.any { allowed ->
            issuers.any { issuer -> issuerMatches(issuer, allowed) }
        }

        return when (query.type) {
            TrustedAuthorityType.OPENID_FEDERATION -> issuerAllowHit
            TrustedAuthorityType.AKI -> {
                val akis = extractAuthorityKeyIdentifiers(credential)
                values.any { wanted -> akis.any { aki -> aki.equals(wanted, ignoreCase = true) } } ||
                    // Some profiles put issuer DIDs under aki by mistake; still honour DID allowlists.
                    (values.any { it.startsWith("did:", ignoreCase = true) } && issuerAllowHit)
            }
            TrustedAuthorityType.ETSI_TL -> {
                // No ETSI TL client in this demo — fail closed unless values clearly name the issuer.
                values.any { it.startsWith("did:", ignoreCase = true) || it.startsWith("http", ignoreCase = true) } &&
                    issuerAllowHit
            }
        }
    }

    /** Issuer identifiers from JWT-style and W3C credential JSON. */
    fun extractIssuerIdentifiers(data: JsonObject): Set<String> {
        val out = linkedSetOf<String>()
        fun add(value: String?) {
            value?.trim()?.takeIf { it.isNotEmpty() }?.let { out.add(it) }
        }
        fun addIssuerElement(element: JsonElement?) {
            when (element) {
                is JsonPrimitive -> add(element.contentOrNull)
                is JsonObject -> add(element["id"]?.jsonPrimitive?.contentOrNull)
                else -> Unit
            }
        }

        add(data["iss"]?.jsonPrimitive?.contentOrNull)
        addIssuerElement(data["issuer"])
        data["vc"]?.jsonObject?.let { vc ->
            addIssuerElement(vc["issuer"])
            add(vc["iss"]?.jsonPrimitive?.contentOrNull)
        }
        return out
    }

    private fun issuerMatches(issuer: String, allowed: String): Boolean {
        if (issuer.equals(allowed, ignoreCase = true)) return true
        // OpenID Federation entity IDs are often compared as exact URLs; allow trailing-slash variants.
        val a = issuer.trimEnd('/')
        val b = allowed.trimEnd('/')
        return a.equals(b, ignoreCase = true)
    }

    /**
     * Best-effort AKI extraction from credential JSON (`x5c` / `aki` style fields).
     * Returns empty when the credential has no usable certificate material.
     */
    private fun extractAuthorityKeyIdentifiers(credential: DcqlCredential): Set<String> {
        val out = linkedSetOf<String>()
        fun walk(element: JsonElement?, depth: Int = 0) {
            if (element == null || depth > 4) return
            when (element) {
                is JsonObject -> {
                    element["aki"]?.jsonPrimitive?.contentOrNull?.let { out.add(it) }
                    element["authorityKeyIdentifier"]?.jsonPrimitive?.contentOrNull?.let { out.add(it) }
                    element.values.forEach { walk(it, depth + 1) }
                }
                is JsonArray -> element.forEach { walk(it, depth + 1) }
                else -> Unit
            }
        }
        walk(credential.data)
        return out
    }
}
