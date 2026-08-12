package nl.harrykodden.secdsa.waltid.key

import id.walt.crypto.keys.JwkKeyMeta
import id.walt.crypto.keys.Key
import id.walt.crypto.keys.KeyGenerationRequest
import id.walt.crypto.keys.KeyManager
import id.walt.crypto.keys.KeyType
import id.walt.crypto.keys.jwk.JWKKey
import id.walt.crypto.utils.Base64Utils.encodeToBase64Url
import id.walt.crypto.utils.JsonUtils.toJsonElement
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.Transient
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import nl.harrykodden.secdsa.waltid.client.PublicJwk
import nl.harrykodden.secdsa.waltid.client.SECDSAKeyMetadata
import nl.harrykodden.secdsa.waltid.client.WscaClient
import nl.harrykodden.secdsa.waltid.config.WscaConfig
import java.math.BigInteger
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECFieldFp
import java.security.spec.ECParameterSpec
import java.security.spec.ECPoint
import java.security.spec.ECPublicKeySpec
import java.security.spec.EllipticCurve
import java.util.Base64

/**
 * Remote holder key backed by SECDSA WSCA (GENKEY / SIGN).
 *
 * Modeled after walt.id `AWSKeyRestAPI` / `TSEKey`: remote sign, local public verify.
 * Private material never leaves SoftHSM / the trust layer.
 *
 * Only [KeyType.secp256r1] / ES256 is supported.
 */
@Serializable
@SerialName("secdsa")
class SECDSAKey(
    val id: String,
    val accountId: String,
    val baseUrl: String,
    /** Uncompressed P-256 public key hex (04‖x‖y) — used for WSCA validity checks. */
    val publicKeyUncompressedHex: String,
    private val publicJwkJson: String,
    @Transient private var client: WscaClient? = null,
) : Key() {

    @Transient
    override var keyType: KeyType = KeyType.secp256r1

    override val hasPrivateKey: Boolean get() = true

    private fun wsca(): WscaClient =
        client ?: WscaClient(WscaConfig(baseUrl = baseUrl, accountId = accountId)).also { client = it }

    fun attachClient(c: WscaClient) {
        client = c
    }

    override suspend fun getKeyId(): String = id

    override suspend fun getThumbprint(): String = getPublicKey().getThumbprint()

    override suspend fun exportJWK(): String = publicJwkJson

    override suspend fun exportJWKObject(): JsonObject =
        Json.parseToJsonElement(publicJwkJson).jsonObject

    override suspend fun exportPEM(): String =
        throw UnsupportedOperationException("PEM export not implemented; use exportJWK()")

    /** ECDSA signature (ASN.1 DER) over SHA-256(plaintext) inside the trust layer. */
    override suspend fun signRaw(plaintext: ByteArray, customSignatureAlgorithm: String?): Any =
        wsca().sign(id, plaintext)

    /**
     * Compact JWS (ES256). Builds signing input locally; signature from WSCA SIGN.
     *
     * Note: lab SIGN re-hashes with SHA-256 — for true ES256 over the signing-input
     * hash only, Phase 0 should accept a prehash / raw-hash mode. Until then this is
     * a demo approximation that still verifies with local SHA256withECDSA on the same bytes.
     */
    override suspend fun signJws(plaintext: ByteArray, headers: Map<String, JsonElement>): String {
        val headerMap = LinkedHashMap<String, JsonElement>().apply {
            put("alg", KeyType.secp256r1.jwsAlg.toJsonElement())
            put("typ", "JWT".toJsonElement())
            putAll(headers)
        }
        val header = Json.encodeToString(headerMap).encodeToByteArray().encodeToBase64Url()
        val payload = plaintext.encodeToBase64Url()
        val signingInput = "$header.$payload"
        val der = signRaw(signingInput.encodeToByteArray()) as ByteArray
        val jose = derToJoseEs256(der)
        return "$signingInput.${jose.encodeToBase64Url()}"
    }

    override suspend fun verifyRaw(
        signed: ByteArray,
        detachedPlaintext: ByteArray?,
        customSignatureAlgorithm: String?,
    ): Result<ByteArray> {
        val plaintext = detachedPlaintext
            ?: return Result.failure(IllegalArgumentException("detached plaintext required"))
        return if (verifyRawLocal(signed, plaintext)) Result.success(plaintext)
        else Result.failure(IllegalArgumentException("SECDSA signature verification failed"))
    }

    override suspend fun verifyJws(signedJws: String): Result<JsonElement> =
        getPublicKey().verifyJws(signedJws)

    override suspend fun getPublicKey(): Key =
        JWKKey.importJWK(publicJwkJson).getOrThrow()

    override suspend fun getPublicKeyRepresentation(): ByteArray =
        WscaClient.hexToBytes(publicKeyUncompressedHex)

    override suspend fun getMeta(): JwkKeyMeta = JwkKeyMeta(keyId = id)

    override suspend fun deleteKey(): Boolean {
        // Stub until trust layer supports destroy — adapter-side revoke only.
        return true
    }

    override fun toString(): String = "[SECDSA secp256r1 key $id @ $baseUrl]"

    /** Local verify (SHA256withECDSA) — same digest model as SoftHSM SIGN. */
    fun verifyRawLocal(signatureDer: ByteArray, plaintext: ByteArray): Boolean {
        val pub = decodeUncompressedP256(WscaClient.hexToBytes(publicKeyUncompressedHex))
        val sig = Signature.getInstance("SHA256withECDSA")
        sig.initVerify(pub)
        sig.update(plaintext)
        return sig.verify(signatureDer)
    }

    companion object {
        private val json = Json {
            ignoreUnknownKeys = true
            encodeDefaults = true
        }

        init {
            // KeyManager only — KeySerialization needs a full WaltCryptoSecdsa.init()
            // (Wallet API startup / CLI main) because it pulls Ktor HTTP engines.
            if (!KeyManager.types.containsKey("secdsa")) {
                KeyManager.register<SECDSAKey>("secdsa") { req -> generate(req) }
            }
        }

        fun registerWithKeyManager() {
            WaltCryptoSecdsa.init()
        }

        suspend fun generate(request: KeyGenerationRequest): SECDSAKey {
            require(request.keyType == KeyType.secp256r1) {
                "SECDSA adapter supports only secp256r1, got ${request.keyType}"
            }
            val meta = request.config?.let {
                json.decodeFromJsonElement(SECDSAKeyMetadata.serializer(), it)
            } ?: error("SECDSA KeyGenerationRequest.config required (baseUrl, accountId)")
            val config = WscaConfig(
                baseUrl = meta.baseUrl,
                accountId = meta.accountId,
                pinEnvFallback = meta.pin,
            )
            val client = WscaClient(config)
            // Prefer explicit unlock from the wallet UI session; config.pin is
            // accepted only as a one-shot generate convenience (not for storage).
            meta.pin?.let { client.unlock(it) }
            return generate(client, config)
        }

        fun generate(client: WscaClient, config: WscaConfig = WscaConfig()): SECDSAKey {
            val gen = client.generateKey()
            val uncompressed = WscaClient.hexToBytes(gen.publicKeyUncompressedHex)
            require(uncompressed.isNotEmpty() && uncompressed[0] == 0x04.toByte()) {
                "expected uncompressed P-256 public key (0x04‖x‖y)"
            }
            val jwk = uncompressedToJwk(uncompressed, gen.keyId)
            return SECDSAKey(
                id = gen.keyId,
                accountId = config.accountId,
                baseUrl = config.normalizedBaseUrl(),
                publicKeyUncompressedHex = gen.publicKeyUncompressedHex,
                publicJwkJson = json.encodeToString(jwk),
                client = client,
            )
        }

        fun uncompressedToJwk(uncompressed: ByteArray, kid: String): PublicJwk {
            require(uncompressed.size == 65 && uncompressed[0] == 0x04.toByte())
            val x = uncompressed.copyOfRange(1, 33)
            val y = uncompressed.copyOfRange(33, 65)
            return PublicJwk(
                x = b64url(x),
                y = b64url(y),
                kid = kid,
            )
        }

        fun b64url(data: ByteArray): String =
            Base64.getUrlEncoder().withoutPadding().encodeToString(data)

        /** Convert ASN.1 DER ECDSA signature to JOSE fixed-length R‖S (32+32). */
        fun derToJoseEs256(der: ByteArray): ByteArray {
            var i = 0
            require(der[i++] == 0x30.toByte())
            val seqLenByte = der[i].toInt() and 0xff
            if (seqLenByte and 0x80 != 0) {
                val n = seqLenByte and 0x7f
                i += 1 + n
            } else {
                i++
            }
            fun readInt(): ByteArray {
                require(der[i++] == 0x02.toByte())
                val len = der[i++].toInt() and 0xff
                val v = der.copyOfRange(i, i + len)
                i += len
                var start = 0
                while (start < v.size - 1 && v[start] == 0.toByte()) start++
                val core = v.copyOfRange(start, v.size)
                return when {
                    core.size == 32 -> core
                    core.size < 32 -> ByteArray(32 - core.size) + core
                    else -> core.copyOfRange(core.size - 32, core.size)
                }
            }
            return readInt() + readInt()
        }

        // P-256 parameters
        private val p = BigInteger("FFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF", 16)
        private val a = BigInteger("FFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFC", 16)
        private val b = BigInteger("5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B", 16)
        private val gx = BigInteger("6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296", 16)
        private val gy = BigInteger("4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5", 16)
        private val n = BigInteger("FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551", 16)
        private val curve = EllipticCurve(ECFieldFp(p), a, b)
        private val spec = ECParameterSpec(curve, ECPoint(gx, gy), n, 1)

        fun decodeUncompressedP256(uncompressed: ByteArray): ECPublicKey {
            require(uncompressed.size == 65 && uncompressed[0] == 0x04.toByte())
            val x = BigInteger(1, uncompressed.copyOfRange(1, 33))
            val y = BigInteger(1, uncompressed.copyOfRange(33, 65))
            val kf = KeyFactory.getInstance("EC")
            return kf.generatePublic(ECPublicKeySpec(ECPoint(x, y), spec)) as ECPublicKey
        }

        fun sha256(data: ByteArray): ByteArray =
            MessageDigest.getInstance("SHA-256").digest(data)
    }
}
