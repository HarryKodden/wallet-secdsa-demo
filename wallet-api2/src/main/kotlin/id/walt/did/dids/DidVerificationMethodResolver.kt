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
        val bare = bareDid(did)
        resolvePurposeKid(bare, "authentication")?.let { return it }
        resolvePurposeKid(bare, "assertionMethod")?.let { return it }
        resolveFirstVerificationMethodId(bare)?.let { return it }
        val fallback = "$bare#0"
        log.debug { "No authentication/assertionMethod id for $bare — using fallback kid $fallback" }
        return fallback
    }

    /** Prefer `assertionMethod`, then authentication (issuer-style binding). */
    suspend fun assertionMethodKid(did: String): String {
        val bare = bareDid(did)
        resolvePurposeKid(bare, "assertionMethod")?.let { return it }
        return authenticationKid(bare)
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
            DidService.resolve(bareDid(did)).getOrThrow()
        } catch (e: Exception) {
            log.warn { "DID resolve failed for $did: ${e.message}" }
            null
        }
    }

    /** Strip DID URL fragment/query (`did:jwk:…#0`) before document resolve. */
    private fun bareDid(did: String): String =
        did.substringBefore('#').substringBefore('?')

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
            is JsonNull -> Unit
        }
        return null
    }
}
