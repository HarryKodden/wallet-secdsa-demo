package id.walt.wallet2.holders

import id.walt.crypto.keys.Key
import id.walt.wallet2.data.Wallet
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import nl.harrykodden.secdsa.waltid.client.WscaClient
import nl.harrykodden.secdsa.waltid.key.SECDSAKey
import java.util.Base64

private val log = KotlinLogging.logger {}
private val json = Json { ignoreUnknownKeys = true }

/**
 * Align OID4VCI proof signing key with the holder DID SoftHSM can actually sign for.
 *
 * SoftHSM SIGN always uses the live user key for the SECDSA account — not whatever
 * public material is baked into an old [SECDSAKey] row. Binding a stale did:jwk
 * (or signing with a stale key metadata object) yields issuer `invalid_proof`.
 */
object HolderProofBinding {

    data class Binding(val key: Key, val did: String?)

    suspend fun resolve(wallet: Wallet, requestedDid: String?, requestedKeyId: String?): Binding {
        val didHint = requestedDid?.takeIf { it.isNotBlank() }
        val key = when {
            !requestedKeyId.isNullOrBlank() ->
                wallet.findKey(requestedKeyId)
                    ?: error("Key '$requestedKeyId' not found in wallet '${wallet.id}'")
            didHint != null ->
                findKeyMatchingDid(wallet, didHint)
                    ?: wallet.resolveKey()
                    ?: error("No key available for DID '$didHint'")
            else ->
                wallet.resolveKey()
                    ?: error("No key available in wallet '${wallet.id}'")
        }

        val matchedDid = when {
            didHint != null && didMatchesKey(didHint, key) -> didHint
            didHint != null -> {
                val alt = findDidMatchingKey(wallet, key)
                val keyId = key.getKeyId()
                log.warn {
                    "Requested DID does not match signing key $keyId " +
                        "(SoftHSM would produce invalid_proof). " +
                        if (alt != null) "Using matching DID instead."
                        else "Falling back to JWK proof binding."
                }
                alt
            }
            else -> {
                val preferred = wallet.defaultDid()
                when {
                    preferred != null && didMatchesKey(preferred, key) -> preferred
                    else -> findDidMatchingKey(wallet, key) ?: preferred
                }
            }
        }

        return Binding(key = key, did = matchedDid)
    }

    suspend fun findKeyMatchingDid(wallet: Wallet, did: String): Key? {
        val didPub = publicKeyHexFromDid(did) ?: return null
        for (info in wallet.listAllKeys()) {
            val key = wallet.findKey(info.keyId) ?: continue
            val keyPub = publicKeyHexFromKey(key) ?: continue
            if (keyPub.equals(didPub, ignoreCase = true)) return key
        }
        return null
    }

    suspend fun findDidMatchingKey(wallet: Wallet, key: Key): String? {
        val keyPub = publicKeyHexFromKey(key) ?: return null
        val entries = wallet.didStore?.listDidsAsList().orEmpty()
        for (entry in entries) {
            val didPub = publicKeyHexFromDid(entry.did) ?: continue
            if (didPub.equals(keyPub, ignoreCase = true)) return entry.did
        }
        return null
    }

    suspend fun didMatchesKey(did: String, key: Key): Boolean {
        val didPub = publicKeyHexFromDid(did) ?: return false
        val keyPub = publicKeyHexFromKey(key) ?: return false
        return didPub.equals(keyPub, ignoreCase = true)
    }

    suspend fun publicKeyHexFromKey(key: Key): String? = when (key) {
        is SECDSAKey -> key.publicKeyUncompressedHex.lowercase()
        else -> runCatching {
            val jwk = key.getPublicKey().exportJWKObject()
            val x = jwk["x"]?.jsonPrimitive?.content ?: return@runCatching null
            val y = jwk["y"]?.jsonPrimitive?.content ?: return@runCatching null
            jwkCoordsToUncompressedHex(x, y).lowercase()
        }.getOrNull()
    }

    fun publicKeyHexFromDid(did: String): String? = when {
        did.startsWith("did:jwk:") -> runCatching { didJwkToUncompressedHex(did) }.getOrNull()
        else -> null
    }

    private fun didJwkToUncompressedHex(did: String): String {
        val encoded = did.removePrefix("did:jwk:")
        val bytes = Base64.getUrlDecoder().decode(padB64Url(encoded))
        val obj = json.parseToJsonElement(bytes.decodeToString()).jsonObject
        val x = obj["x"]?.jsonPrimitive?.content ?: error("did:jwk missing x")
        val y = obj["y"]?.jsonPrimitive?.content ?: error("did:jwk missing y")
        return jwkCoordsToUncompressedHex(x, y)
    }

    private fun jwkCoordsToUncompressedHex(xB64: String, yB64: String): String {
        val x = Base64.getUrlDecoder().decode(padB64Url(xB64))
        val y = Base64.getUrlDecoder().decode(padB64Url(yB64))
        require(x.size <= 32 && y.size <= 32)
        val xb = ByteArray(32 - x.size) + x
        val yb = ByteArray(32 - y.size) + y
        return "04" + WscaClient.bytesToHex(xb + yb)
    }

    private fun padB64Url(s: String): String {
        val pad = (4 - s.length % 4) % 4
        return s + "=".repeat(pad)
    }
}
