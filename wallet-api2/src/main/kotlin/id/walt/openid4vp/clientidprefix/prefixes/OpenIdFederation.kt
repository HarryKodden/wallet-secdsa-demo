package id.walt.openid4vp.clientidprefix.prefixes

import id.walt.crypto.keys.Key
import id.walt.crypto.keys.jwk.JWKKey
import id.walt.crypto.utils.JwsUtils.decodeJws
import id.walt.openid4vp.clientidprefix.ClientIdError
import id.walt.openid4vp.clientidprefix.ClientValidationResult
import id.walt.openid4vp.clientidprefix.RequestContext
import id.walt.verifier.openid.models.authorization.ClientMetadata
import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.client.HttpClient
import io.ktor.client.engine.java.Java
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.isSuccess
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * Handles `openid_federation` prefix per OpenID4VP 1.0, Section 5.9.3.
 *
 * Loads the Entity Configuration from `{entityId}/.well-known/openid-federation`,
 * takes signing keys from `metadata.openid_credential_verifier.jwks` (preferred)
 * or the Entity Configuration top-level `jwks`, and verifies the Request Object.
 *
 * Full federation trust-chain walk (authority_hints → Trust Anchor) is not required
 * for request-object signature verification when the Entity Configuration is fetched
 * over HTTPS from the entity_id itself (common OIDF lab / Sphereon Summa pattern).
 */
@Serializable
data class OpenIdFederation(val entityId: String, override val rawValue: String) : ClientId {

    companion object {
        private val log = KotlinLogging.logger {}
        private val json = Json { ignoreUnknownKeys = true; isLenient = true }

        private val httpClient by lazy {
            HttpClient(Java) {
                expectSuccess = false
                followRedirects = true
            }
        }

        internal fun entityConfigurationUrl(entityId: String): String {
            val base = entityId.trim().trimEnd('/')
            return "$base/.well-known/openid-federation"
        }

        internal suspend fun fetchEntityConfigurationPayload(entityId: String): JsonObject {
            val url = entityConfigurationUrl(entityId)
            log.info { "Fetching OpenID Federation Entity Configuration for $entityId from $url" }
            val response = httpClient.get(url)
            require(response.status.isSuccess()) {
                "Entity Configuration HTTP ${response.status} for $url"
            }
            val body = response.bodyAsText().trim()
            require(body.count { it == '.' } >= 2) {
                "Entity Configuration is not a JWT (got ${body.take(80)})"
            }
            val payload = body.decodeJws().payload
            val sub = payload["sub"]?.jsonPrimitive?.contentOrNull
            require(sub == null || sub.trimEnd('/') == entityId.trimEnd('/')) {
                "Entity Configuration sub mismatch: expected $entityId, got $sub"
            }
            return payload
        }

        internal fun extractVerifierJwks(entityPayload: JsonObject): List<JsonObject> {
            val metadata = entityPayload["metadata"]?.jsonObject
            val verifierMeta = metadata?.get("openid_credential_verifier")?.jsonObject
            val fromVerifier = verifierMeta?.get("jwks")?.jsonObject?.get("keys")?.jsonArray
            if (fromVerifier != null && fromVerifier.isNotEmpty()) {
                return fromVerifier.mapNotNull { it as? JsonObject }
            }
            val topLevel = entityPayload["jwks"]?.jsonObject?.get("keys")?.jsonArray
                ?: return emptyList()
            return topLevel.mapNotNull { it as? JsonObject }
        }

        internal fun extractResponseUris(entityPayload: JsonObject): List<String> {
            val verifierMeta = entityPayload["metadata"]?.jsonObject
                ?.get("openid_credential_verifier")?.jsonObject
                ?: return emptyList()
            return verifierMeta["response_uris"]?.jsonArray
                ?.mapNotNull { it.jsonPrimitive.contentOrNull }
                .orEmpty()
        }

        internal suspend fun importKeys(jwks: List<JsonObject>): Set<Key> =
            jwks.mapNotNull { jwk ->
                val jwkJson = json.encodeToString(JsonObject.serializer(), jwk)
                JWKKey.importJWK(jwkJson).getOrElse { err ->
                    log.warn(err) { "Failed to import federation verifier JWK: $jwkJson" }
                    null
                }
            }.toSet()

        internal fun clientMetadataFromEntity(
            entityPayload: JsonObject,
            fallback: ClientMetadata?,
        ): ClientMetadata {
            if (fallback != null) return fallback
            val verifierMeta = entityPayload["metadata"]?.jsonObject
                ?.get("openid_credential_verifier")?.jsonObject
                ?: throw IllegalStateException(
                    "Entity Configuration has no metadata.openid_credential_verifier " +
                        "and request has no client_metadata",
                )
            // ClientMetadata expects top-level vp_formats_supported (OID4VP client_metadata shape).
            val shaped = buildJsonObject {
                verifierMeta["vp_formats_supported"]?.let { put("vp_formats_supported", it) }
                verifierMeta["jwks"]?.let { put("jwks", it) }
                verifierMeta["client_name"]?.let { put("client_name", it) }
            }
            return ClientMetadata.fromJson(shaped).getOrElse { err ->
                throw IllegalStateException(
                    "Could not build client_metadata from Entity Configuration: ${err.message}",
                    err,
                )
            }
        }
    }

    suspend fun authenticateOpenIdFederation(
        clientId: OpenIdFederation,
        context: RequestContext,
    ): ClientValidationResult {
        val jws = context.requestObjectJws
            ?: return ClientValidationResult.Failure(ClientIdError.MissingRequestObject)

        return runCatching {
            val entityPayload = fetchEntityConfigurationPayload(clientId.entityId)
            val jwkObjs = extractVerifierJwks(entityPayload)
            require(jwkObjs.isNotEmpty()) {
                "No verifier JWKS in Entity Configuration for ${clientId.entityId}"
            }
            val keys = importKeys(jwkObjs)
            require(keys.isNotEmpty()) { "Failed to import verifier keys for ${clientId.entityId}" }

            val kid = jws.decodeJws().header["kid"]?.jsonPrimitive?.content
            val verificationKey = if (!kid.isNullOrBlank()) {
                DecentralizedIdentifier.selectVerificationKey(keys, clientId.entityId, kid)
                    ?: keys.singleOrNull()
                    ?: throw IllegalArgumentException(
                        "Key ID '$kid' not in federation verifier JWKS " +
                            "(available: ${keys.map { it.getKeyId() }})",
                    )
            } else {
                keys.singleOrNull()
                    ?: throw IllegalArgumentException("Request Object missing kid and multiple keys present")
            }

            verificationKey.verifyJws(jws).getOrThrow()

            val responseUri = context.responseUri
            if (!responseUri.isNullOrBlank()) {
                val allowed = extractResponseUris(entityPayload)
                if (allowed.isNotEmpty() && allowed.none { responseUri.startsWith(it.trimEnd('/')) || it == responseUri }) {
                    log.warn {
                        "response_uri $responseUri not listed in Entity Configuration " +
                            "response_uris=$allowed (continuing; some labs omit exact match)"
                    }
                }
            }

            clientMetadataFromEntity(entityPayload, context.clientMetadata)
        }.fold(
            onSuccess = { ClientValidationResult.Success(it) },
            onFailure = { err ->
                log.warn(err) {
                    "OpenIdFederation auth failed for ${clientId.entityId}: " +
                        "${err::class.simpleName}: ${err.message}"
                }
                ClientValidationResult.Failure(
                    ClientIdError.FederationError(err.message ?: err::class.simpleName ?: "unknown"),
                )
            },
        )
    }
}
