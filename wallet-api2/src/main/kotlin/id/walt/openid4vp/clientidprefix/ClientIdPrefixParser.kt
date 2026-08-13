package id.walt.openid4vp.clientidprefix

import id.walt.openid4vp.clientidprefix.prefixes.*
import io.ktor.http.*

enum class ClientIdPrefix(val value: String) {
    PRE_REGISTERED("pre-registered"),
    REDIRECT_URI("redirect_uri"),
    X509_SAN_DNS("x509_san_dns"),
    X509_HASH("x509_hash"),
    /**
     * OID4VP 1.0 prefix form: `decentralized_identifier:did:…`.
     */
    DECENTRALIZED_IDENTIFIER("decentralized_identifier"),
    /**
     * DIIP / earlier OID4VP drafts: Client Identifier Scheme `did`, where
     * `client_id` is the DID itself (`did:web:…` / `did:jwk:…`) with no extra prefix.
     * Advertised in wallet metadata; parsing also accepts bare DIDs (see [ClientIdPrefixParser]).
     */
    DID("did"),
    VERIFIER_ATTESTATION("verifier_attestation"),
    OPENID_FEDERATION("openid_federation");

    companion object {
        fun fromValue(value: String): ClientIdPrefix? = entries.find { it.value == value }
    }
}

object ClientIdPrefixParser {
    private val didRegex = Regex("^did:[a-z0-9]+:.+", RegexOption.IGNORE_CASE)

    fun parse(clientIdString: String): Result<ClientId> {
        return runCatching {
            val trimmed = clientIdString.trim()
            require(trimmed.isNotEmpty()) { "client_id must not be blank" }

            // DIIP MUST: Client Identifier Scheme `did` — client_id is the DID itself.
            if (didRegex.matches(trimmed)) {
                return@runCatching DecentralizedIdentifier(did = trimmed, rawValue = trimmed)
            }

            val parts = trimmed.split(":", limit = 2)
            if (parts.size < 2) {
                PreRegistered(trimmed)
            } else {
                val prefix = parts[0]
                val id = parts[1]
                when (ClientIdPrefix.fromValue(prefix)) {
                    ClientIdPrefix.REDIRECT_URI -> RedirectUri(Url(id), trimmed)
                    ClientIdPrefix.X509_SAN_DNS -> X509SanDns(id, trimmed)
                    ClientIdPrefix.X509_HASH -> X509Hash(id, trimmed)
                    ClientIdPrefix.DECENTRALIZED_IDENTIFIER -> DecentralizedIdentifier(id, trimmed)
                    // `did:…` already handled above; prefix-only `did` with a non-DID remainder is invalid.
                    ClientIdPrefix.DID -> {
                        val did = if (didRegex.matches(id)) id else "did:$id"
                        require(didRegex.matches(did)) { "Invalid DID in client_id: $trimmed" }
                        DecentralizedIdentifier(did = did, rawValue = trimmed)
                    }
                    ClientIdPrefix.VERIFIER_ATTESTATION -> VerifierAttestation(id, trimmed)
                    ClientIdPrefix.OPENID_FEDERATION -> OpenIdFederation(id, trimmed)

                    // Pre-registered clients are represented by the absence of a prefix.
                    ClientIdPrefix.PRE_REGISTERED, null -> Unsupported(prefix, trimmed)
                }
            }
        }
    }
}
