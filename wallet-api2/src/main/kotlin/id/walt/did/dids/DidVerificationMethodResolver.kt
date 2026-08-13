package id.walt.did.dids

import id.walt.did.dids.DidService
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.serialization.json.*

/**
 * Resolve verification-method IDs from a DID document for OID4VCI PoP / holder binding.
 *
 * DIIP expects JWT proof `kid` (and holder `cnf.kid` when issuer-set) to reference a
 * DID URL from `authentication` / `assertionMethod`, not a bare DID string.
 */
object DidVerificationMethodResolver {

    private val log = KotlinLogging.logger {}

    /**
     * Prefer the first `authentication` method id, then `assertionMethod`, then
     * the first `verificationMethod.id`. Falls back to `"$did#0"` (did:jwk convention).
     */
    suspend fun authenticationKid(did: String): String {
        resolvePurposeKid(did, "authentication")?.let { return it }
        resolvePurposeKid(did, "assertionMethod")?.let { return it }
        resolveFirstVerificationMethodId(did)?.let { return it }
        val fallback = "$did#0"
        log.debug { "No authentication/assertionMethod id for $did — using fallback kid $fallback" }
        return fallback
    }

    /** Prefer `assertionMethod`, then authentication (issuer-style binding). */
    suspend fun assertionMethodKid(did: String): String {
        resolvePurposeKid(did, "assertionMethod")?.let { return it }
        return authenticationKid(did)
    }

    private suspend fun resolvePurposeKid(did: String, purpose: String): String? {
        val doc = resolveDocument(did) ?: return null
        val element = doc[purpose] ?: return null
        return firstDidUrl(element)
    }

    private suspend fun resolveFirstVerificationMethodId(did: String): String? {
        val doc = resolveDocument(did) ?: return null
        val vms = doc["verificationMethod"] as? JsonArray ?: return null
        for (vm in vms) {
            val id = (vm as? JsonObject)?.get("id")?.jsonPrimitive?.contentOrNull
            if (!id.isNullOrBlank()) return id
        }
        return null
    }

    private suspend fun resolveDocument(did: String): Map<String, JsonElement>? {
        return try {
            DidService.resolve(did).getOrThrow()
        } catch (e: Exception) {
            log.warn { "DID resolve failed for $did: ${e.message}" }
            null
        }
    }

    private fun firstDidUrl(element: JsonElement): String? {
        when (element) {
            is JsonArray -> {
                for (entry in element) {
                    when (entry) {
                        is JsonPrimitive -> entry.contentOrNull?.takeIf { it.isNotBlank() }?.let { return it }
                        is JsonObject -> entry["id"]?.jsonPrimitive?.contentOrNull
                            ?.takeIf { it.isNotBlank() }
                            ?.let { return it }
                        else -> Unit
                    }
                }
            }
            is JsonPrimitive -> return element.contentOrNull?.takeIf { it.isNotBlank() }
            is JsonObject -> return element["id"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
            else -> Unit
        }
        return null
    }
}
