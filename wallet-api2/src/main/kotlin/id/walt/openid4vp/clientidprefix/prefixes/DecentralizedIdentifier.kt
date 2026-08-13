package id.walt.openid4vp.clientidprefix.prefixes

import id.walt.crypto.keys.Key
import id.walt.crypto.utils.JwsUtils.decodeJws
import id.walt.did.dids.DidService
import id.walt.openid4vp.clientidprefix.ClientIdError
import id.walt.openid4vp.clientidprefix.ClientValidationResult
import id.walt.openid4vp.clientidprefix.RequestContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.jsonPrimitive

/**
 * Handles DID-based verifier client identifiers:
 * - OID4VP 1.0: `decentralized_identifier:did:…`
 * - DIIP `did` scheme: bare `did:jwk:…` / `did:web:…` as `client_id`
 */
@Serializable
data class DecentralizedIdentifier(val did: String, override val rawValue: String) : ClientId {

    companion object {
        private val didRegex = "^did:[a-z0-9]+:.+".toRegex()

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

            val keys = DidService.resolveToKeys(clientId.did).getOrThrow()

            val verificationKey = selectVerificationKey(keys, clientId.did, kid)
                ?: throw IllegalArgumentException("Key ID '$kid' from JWS not found in DID document.")

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
