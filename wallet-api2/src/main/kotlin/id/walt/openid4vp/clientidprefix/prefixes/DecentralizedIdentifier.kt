package id.walt.openid4vp.clientidprefix.prefixes

import id.walt.crypto.keys.Key
import id.walt.crypto.keys.jwk.JWKKey
import id.walt.crypto.utils.JwsUtils.decodeJws
import id.walt.did.dids.DidService
import id.walt.openid4vp.clientidprefix.ClientIdError
import id.walt.openid4vp.clientidprefix.ClientValidationResult
import id.walt.openid4vp.clientidprefix.RequestContext
import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.isSuccess
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Handles DID-based verifier client identifiers:
 * - OID4VP 1.0: `decentralized_identifier:did:…`
 * - DIIP `did` scheme: bare `did:jwk:…` / `did:web:…` as `client_id`
 *
 * SURF OIDF lab (and similar) advertise `did:web:…` but only publish
 * `/.well-known/openid-credential-verifier` + `jwks_uri` (no did.json). When DID
 * resolve fails for did:web, fall back to that JWKS for request-object verification.
 */
@Serializable
data class DecentralizedIdentifier(val did: String, override val rawValue: String) : ClientId {

    companion object {
        private val log = KotlinLogging.logger {}
        private val didRegex = "^did:[a-z0-9]+:.+".toRegex()
        private val json = Json { ignoreUnknownKeys = true }

        private val httpClient by lazy {
            HttpClient(CIO) {
                expectSuccess = false
                followRedirects = true
            }
        }

        /**
         * Match JWT `kid` to a resolved DID key.
         *
         * did:jwk documents use verificationMethod id `did:jwk:…#0`, while
         * [Key.getKeyId] is often the JWK thumbprint (or embedded `kid`).
         * Sandboxes commonly set JWT kid to the DID URL + `#0`.
         */
        internal suspend fun selectVerificationKey(
            keys: Set<Key>,
            did: String,
            kid: String,
        ): Key? {
            if (keys.isEmpty()) return null

            val kidFragment = kid.substringAfter('#', missingDelimiterValue = "").ifEmpty { null }
            val kidWithoutFragment = kid.substringBefore('#')

            keys.firstOrNull { key ->
                val keyId = key.getKeyId()
                keyId == kid ||
                    keyId == kidFragment ||
                    kid.endsWith("#$keyId") ||
                    (kidWithoutFragment == did && kidFragment != null && keys.size == 1)
            }?.let { return it }

            return keys.singleOrNull()
        }

        /** `did:web:example.com:path` → `https://example.com/path` */
        internal fun didWebHttpsBase(did: String): String? {
            if (!did.startsWith("did:web:")) return null
            val rest = did.removePrefix("did:web:")
            if (rest.isBlank()) return null
            val parts = rest.split(':')
            val host = parts.first().replace("%3A", ":", ignoreCase = true)
            val path = parts.drop(1).joinToString("/")
            return if (path.isEmpty()) "https://$host" else "https://$host/$path"
        }

        internal suspend fun resolveVerificationKeys(did: String): Set<Key> {
            // walt.id DidService.resolveToKeys often *throws* on missing did.json
            // (SURF OIDF) instead of returning Result.failure — catch so JWKS fallback runs.
            val didResolve = runCatching { DidService.resolveToKeys(did) }
            val didKeys = didResolve.getOrNull()?.getOrNull().orEmpty()
            if (didKeys.isNotEmpty()) return didKeys

            val didErr =
                didResolve.exceptionOrNull()
                    ?: didResolve.getOrNull()?.exceptionOrNull()

            if (!did.startsWith("did:web:")) {
                throw didErr ?: IllegalStateException("No verification keys for $did")
            }

            log.warn {
                "DID document resolve failed for $did (${didErr?.message}); " +
                    "trying openid-credential-verifier / JWKS fallback"
            }
            val fromJwks = resolveDidWebKeysFromVerifierJwks(did)
            if (fromJwks.isNotEmpty()) return fromJwks

            throw didErr
                ?: IllegalStateException("No verification keys for $did (DID + JWKS fallback empty)")
        }

        internal suspend fun resolveDidWebKeysFromVerifierJwks(did: String): Set<Key> {
            val base = didWebHttpsBase(did) ?: return emptySet()
            val jwksUri = fetchJwksUriForVerifier(base) ?: "$base/.well-known/jwks.json"
            return fetchKeysFromJwksUri(jwksUri)
        }

        private suspend fun fetchJwksUriForVerifier(base: String): String? {
            val metaUrl = "$base/.well-known/openid-credential-verifier"
            return runCatching {
                val response = httpClient.get(metaUrl)
                if (!response.status.isSuccess()) return null
                val obj = json.parseToJsonElement(response.bodyAsText()).jsonObject
                obj["jwks_uri"]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
            }.onFailure {
                log.debug(it) { "openid-credential-verifier fetch failed for $metaUrl" }
            }.getOrNull()
        }

        private suspend fun fetchKeysFromJwksUri(jwksUri: String): Set<Key> {
            val response = httpClient.get(jwksUri)
            require(response.status.isSuccess()) { "JWKS fetch failed ($jwksUri): ${response.status}" }
            val keysArr = json.parseToJsonElement(response.bodyAsText()).jsonObject["keys"]?.jsonArray
                ?: return emptySet()
            return keysArr.mapNotNull { element ->
                val jwk = element as? JsonObject ?: return@mapNotNull null
                JWKKey.importJWK(jwk.toString()).getOrNull()
            }.toSet()
        }
    }

    init {
        require(didRegex.matches(did)) { "Invalid DID format." }
    }

    suspend fun authenticateDecentralizedIdentifier(
        clientId: DecentralizedIdentifier,
        context: RequestContext,
    ): ClientValidationResult {
        val jws = context.requestObjectJws
            ?: return ClientValidationResult.Failure(ClientIdError.MissingRequestObject)

        return runCatching {
            val kid = jws.decodeJws().header["kid"]?.jsonPrimitive?.content
                ?: throw IllegalStateException("Missing 'kid' header in JWS for key selection.")

            val keys = resolveVerificationKeys(clientId.did)

            val verificationKey = selectVerificationKey(keys, clientId.did, kid)
                ?: throw IllegalArgumentException("Key ID '$kid' from JWS not found in DID document or JWKS.")

            verificationKey.verifyJws(jws).getOrThrow()

            val metadataJson = context.clientMetadata
                ?: throw IllegalStateException("client_metadata parameter is required.")
            metadataJson
        }.fold(
            onSuccess = { ClientValidationResult.Success(it) },
            onFailure = { ClientValidationResult.Failure(ClientIdError.DidResolutionFailed(it.message!!)) },
        )
    }
}
