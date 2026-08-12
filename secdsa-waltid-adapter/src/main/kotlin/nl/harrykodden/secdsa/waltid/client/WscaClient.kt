package nl.harrykodden.secdsa.waltid.client

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import nl.harrykodden.secdsa.waltid.config.WscaConfig
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * HTTP client for HarryKodden/SECDSA trust-layer APIs.
 *
 * Prefers future `/v1/...` endpoints; falls back to today's lab `/api/...`
 * until Phase 0 lands in the SECDSA repo.
 *
 * Lab snapshot `lastResult` truncates GENKEY/SIGN payloads — interim parsing
 * uses `userPub` (GENKEY) and `/api/judge/package` record `result` hex (SIGN).
 */
class WscaClient(
    private val config: WscaConfig,
    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build(),
) {
    private val json = Json { ignoreUnknownKeys = true }
    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    @Volatile
    private var unlockedPin: String? = null

    fun unlock(pin: String) {
        require(pin.length >= 4) { "PIN must be at least 4 characters" }
        unlockedPin = pin
        SecdsaPinSession.unlock(config.accountId, pin)
        // SoftHSM rejects SIGN until Protocol-4 activate; GENKEY already did this.
        ensureActivated()
    }

    fun clearUnlock() {
        unlockedPin = null
        SecdsaPinSession.clear(config.accountId)
    }

    private fun pin(): String =
        unlockedPin
            ?: SecdsaPinSession.get(config.accountId)
            ?: config.pinEnvFallback
            ?: error("Unlock with PIN from the wallet UI first (or set WSCA_PIN for lab demos only)")

    /**
     * Ensure the lab has a slot for [config.accountId] and make it active.
     * Lab `/api/wallets/add` creates missing accounts and selects them;
     * `/api/wallets/select` alone fails with 400 for unknown OIDC `sub` ids.
     */
    fun selectAccount() {
        val addBody = """{"id":${jsonStr(config.accountId)}}"""
        // Must succeed — new OIDC accounts are not pre-seeded (unlike citizen-42).
        val added = postJson("/api/wallets/add", addBody)
        if (added.contains("\"error\"")) {
            error("WSCA add wallet failed: ${shortError(added)}")
        }
        // Redundant when add selected the account; keep for older lab builds.
        postJsonOptional(
            "/api/wallets/select",
            addBody,
        )
    }

    /**
     * Activate account (Protocol 4) if the lab reports not activated.
     * Interim: lab `POST /api/activate` (single active account).
     */
    fun ensureActivated() {
        val pin = pin()
        selectAccount()
        // Prefer /v1 when available; ignore 404 and use lab API.
        if (postJsonOptional("/v1/accounts/${config.accountId}/activate", """{"pin":${jsonStr(pin)}}""") != null) {
            return
        }
        val body = postJson("/api/activate", """{"pin":${jsonStr(pin)}}""")
        if (body.contains("\"error\"")) {
            if (!body.contains("already activated", ignoreCase = true)) {
                error("activate failed: $body")
            }
        }
    }

    /**
     * GENKEY via trust layer. Returns public key uncompressed hex (04‖x‖y) and sequence number when known.
     *
     * PoC: one SoftHSM / memory-WSCD user key per account. Prefer re-importing the
     * existing `userPub` (no PIN) unless [forceNew] is set. Minting a second key is
     * not supported by the lab and breaks wallets that still hold `secdsa:{account}:1`.
     */
    fun generateKey(forceNew: Boolean = false): GenerateResult {
        // Re-bind without PIN when SoftHSM already holds the account's user key.
        // (Deleting the key from the walt.id wallet does not delete SoftHSM material.)
        if (!forceNew) {
            loadExistingKey()?.let { return it }
        }

        ensureActivated()
        val pin = pin()
        requireNotBlocked()

        postJsonOptional(
            "/v1/accounts/${config.accountId}/keys",
            """{"pin":${jsonStr(pin)}}""",
        )?.let { raw ->
            if (raw.contains("\"error\"")) {
                // Fall back to lab instruct / existing key rather than aborting.
            } else {
                val el = json.parseToJsonElement(raw).jsonObject
                val pub = el["publicKeyHex"]?.jsonPrimitive?.content
                if (pub != null) {
                    return GenerateResult(
                        keyId = el["keyId"]?.jsonPrimitive?.content
                            ?: stableKeyId(),
                        publicKeyUncompressedHex = pub,
                        trSn = el["trSn"]?.jsonPrimitive?.content?.toUIntOrNull(),
                    )
                }
            }
        }

        val raw = postJson(
            "/api/instruct",
            """{"pin":${jsonStr(pin)},"op":"GENKEY","data":""}""",
        )
        if (raw.contains("\"error\"")) {
            // Race / already-keyed account: re-import instead of failing the wallet UI.
            loadExistingKey()?.let { return it }
            val err = shortError(raw)
            if (err.contains("blocked", ignoreCase = true)) {
                error(
                    "SECDSA account '${config.accountId}' is PIN-blocked. " +
                        "Restart the secdsa lab container (memory backend) or reset that account, then activate with your PIN again."
                )
            }
            if (err.contains("wrong PIN", ignoreCase = true) || err.contains("Alg22", ignoreCase = true)) {
                error(
                    "GENKEY failed for '${config.accountId}': wrong PIN (or account not activated with this PIN). " +
                        "Use the PIN you set at first login — lab default 424242 only applies to a fresh citizen-42 slot."
                )
            }
            error("GENKEY failed: $err")
        }
        val pub = extractUserPubHex(raw)
            ?: fetchJudgeResultHex(extractWalletSn(raw))
            ?: error("GENKEY: could not parse userPub / judge result from lab")
        return GenerateResult(
            keyId = stableKeyId(),
            publicKeyUncompressedHex = pub,
            trSn = extractWalletSn(raw),
        )
    }

    /** Load existing SoftHSM user key from lab snapshot (no GENKEY, no PIN). */
    fun loadExistingKey(): GenerateResult? {
        selectAccount()
        val state = getJson("/api/state")
        val el = runCatching { json.parseToJsonElement(state).jsonObject }.getOrNull() ?: return null
        if (!jsonFlag(el, "hasUserKey")) return null
        val pub = extractUserPubHex(state) ?: return null
        return GenerateResult(
            keyId = stableKeyId(),
            publicKeyUncompressedHex = pub,
            trSn = extractWalletSn(state),
        )
    }

    /**
     * Cheap validity probe (no PIN): whether the account is activated and which
     * user public key the WSCD currently holds.
     */
    fun readAccountSnapshot(): AccountSnapshot {
        selectAccount()
        val state = getJson("/api/state")
        val el = runCatching { json.parseToJsonElement(state).jsonObject }.getOrNull()
        return AccountSnapshot(
            activated = el != null && jsonFlag(el, "activated"),
            hasUserKey = el != null && jsonFlag(el, "hasUserKey"),
            backend = el?.get("backend")?.jsonPrimitive?.content,
            userPubHex = extractUserPubHex(state),
            walletSn = extractWalletSn(state),
            blocked = el?.get("wsca")?.jsonObject?.let { jsonFlag(it, "blocked") } == true,
        )
    }

    private fun stableKeyId(): String = "secdsa:${config.accountId}:1"

    private fun requireNotBlocked() {
        val snap = readAccountSnapshot()
        if (snap.blocked) {
            error(
                "SECDSA account '${config.accountId}' is PIN-blocked. " +
                    "Restart the secdsa lab container (memory backend) or reset that account, then activate with your PIN again."
            )
        }
    }

    private fun jsonFlag(obj: kotlinx.serialization.json.JsonObject, key: String): Boolean {
        val p = obj[key]?.jsonPrimitive ?: return false
        return p.content.equals("true", ignoreCase = true)
    }

    private fun shortError(snapshotOrErrorJson: String): String {
        val el = runCatching { json.parseToJsonElement(snapshotOrErrorJson).jsonObject }.getOrNull()
        return el?.get("error")?.jsonPrimitive?.content ?: snapshotOrErrorJson.take(200)
    }

    /**
     * SIGN: trust layer hashes SHA-256(payload) then ECDSA (ASN.1 DER).
     * [payload] should be the bytes you intend the lab to hash (e.g. JWS signing input).
     */
    fun sign(keyId: String, payload: ByteArray): ByteArray {
        // SoftHSM requires Protocol-4 activate before SIGN; GENKEY already did this,
        // but unlock only stored the PIN — activate here so OID4VCI proofs work.
        ensureActivated()
        val pin = pin()
        val b64 = java.util.Base64.getEncoder().encodeToString(payload)
        postJsonOptional(
            "/v1/accounts/${config.accountId}/keys/$keyId/sign",
            """{"pin":${jsonStr(pin)},"payloadBase64":${jsonStr(b64)},"format":"der"}""",
        )?.let { raw ->
            val el = json.parseToJsonElement(raw).jsonObject
            val sigB64 = el["signatureBase64"]?.jsonPrimitive?.content
                ?: error("v1 sign missing signatureBase64: $raw")
            return java.util.Base64.getDecoder().decode(sigB64)
        }

        selectAccount()
        // Lab API takes UTF-8 string `data` — interim latin-1 so binary bytes survive (demo only).
        val dataField = payload.toString(Charsets.ISO_8859_1)
        val raw = postJson(
            "/api/instruct",
            """{"pin":${jsonStr(pin)},"op":"SIGN","data":${jsonStr(dataField)}}""",
        )
        if (raw.contains("\"error\"")) error("SIGN failed: ${shortError(raw)}")
        val sn = extractWalletSn(raw)
            ?: error("SIGN: missing walletSN in lab snapshot")
        val hex = fetchJudgeResultHex(sn)
            ?: error("SIGN: could not read full signature from /api/judge/package sn=$sn")
        return hexToBytes(hex)
    }

    fun health(): Boolean = try {
        val req = Request.Builder().url("${config.normalizedBaseUrl()}/api/state").get().build()
        http.newCall(req).execute().use { it.isSuccessful }
    } catch (_: Exception) {
        false
    }

    private fun postJsonOptional(path: String, body: String): String? {
        val req = Request.Builder()
            .url(config.normalizedBaseUrl() + path)
            .post(body.toRequestBody(jsonMedia))
            .build()
        return try {
            http.newCall(req).execute().use { resp ->
                val text = resp.body?.string().orEmpty()
                when {
                    // 404 = endpoint not present yet; 400 on select = unknown account
                    // after a race / older lab — caller already ensured via /add when needed.
                    resp.code == 404 || resp.code == 400 -> null
                    !resp.isSuccessful -> error("HTTP ${resp.code} $path: $text")
                    else -> text
                }
            }
        } catch (e: java.net.ConnectException) {
            throw e
        }
    }

    private fun postJson(path: String, body: String): String {
        val req = Request.Builder()
            .url(config.normalizedBaseUrl() + path)
            .post(body.toRequestBody(jsonMedia))
            .build()
        http.newCall(req).execute().use { resp ->
            val text = resp.body?.string().orEmpty()
            if (!resp.isSuccessful && resp.code != 400) {
                error("HTTP ${resp.code} $path: $text")
            }
            return text
        }
    }

    private fun getJson(path: String): String {
        val req = Request.Builder()
            .url(config.normalizedBaseUrl() + path)
            .get()
            .build()
        http.newCall(req).execute().use { resp ->
            val text = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) error("HTTP ${resp.code} $path: $text")
            return text
        }
    }

    private fun jsonStr(s: String): String = json.encodeToString(s)

    /** Full uncompressed pub hex from lab snapshot (not truncated lastResult). */
    private fun extractUserPubHex(snapshotJson: String): String? {
        val el = runCatching { json.parseToJsonElement(snapshotJson).jsonObject }.getOrNull() ?: return null
        val pub = el["userPub"]?.jsonPrimitive?.content ?: return null
        if (pub.length < 130) return null // 65 bytes → 130 hex
        return pub
    }

    private fun extractWalletSn(snapshotJson: String): UInt? {
        val el = runCatching { json.parseToJsonElement(snapshotJson).jsonObject }.getOrNull() ?: return null
        return el["walletSN"]?.jsonPrimitive?.content?.toUIntOrNull()
            ?: el["walletSn"]?.jsonPrimitive?.content?.toUIntOrNull()
    }

    /**
     * Lab UI truncates `lastResult` / snapshot `records[].result`.
     * Judge package exports full Tr `result` as hex — enough for interim demos.
     */
    private fun fetchJudgeResultHex(sn: UInt?): String? {
        if (sn == null) return null
        val pkg = getJson("/api/judge/package")
        val records = runCatching {
            json.parseToJsonElement(pkg).jsonObject["records"]?.jsonArray
        }.getOrNull() ?: return null
        for (rec in records) {
            val obj = rec.jsonObject
            val recSn = obj["sn"]?.jsonPrimitive?.content?.toUIntOrNull() ?: continue
            if (recSn == sn) {
                val result = obj["result"]?.jsonPrimitive?.content ?: continue
                if (result.length >= 8) return result
            }
        }
        return null
    }

    companion object {
        fun hexToBytes(hex: String): ByteArray {
            val h = if (hex.length % 2 == 0) hex else "0$hex"
            return ByteArray(h.length / 2) { i ->
                h.substring(i * 2, i * 2 + 2).toInt(16).toByte()
            }
        }

        fun bytesToHex(b: ByteArray): String =
            b.joinToString("") { "%02x".format(it) }
    }
}

@Serializable
data class GenerateResult(
    val keyId: String,
    val publicKeyUncompressedHex: String,
    val trSn: UInt? = null,
)

data class AccountSnapshot(
    val activated: Boolean,
    val hasUserKey: Boolean,
    val backend: String?,
    val userPubHex: String?,
    val walletSn: UInt? = null,
    val blocked: Boolean = false,
)

@Serializable
data class PublicJwk(
    val kty: String = "EC",
    val crv: String = "P-256",
    val x: String,
    val y: String,
    @SerialName("kid") val kid: String? = null,
    @SerialName("use") val use: String? = "sig",
    @SerialName("alg") val alg: String? = "ES256",
)

@Serializable
data class SECDSAKeyMetadata(
    val baseUrl: String,
    val accountId: String,
    /**
     * Optional one-shot PIN for generate only.
     * Prefer wallet-UI unlock → [SecdsaPinSession] / [WscaClient.unlock].
     * Do not persist in server config for real wallets.
     */
    val pin: String? = null,
)
