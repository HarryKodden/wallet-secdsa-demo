package id.walt.wallet2

import id.walt.wallet2.data.Wallet
import id.walt.wallet2.server.WalletResolver
import io.github.smiley4.ktoropenapi.get
import io.github.smiley4.ktoropenapi.post
import io.github.smiley4.ktoropenapi.route
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import nl.harrykodden.secdsa.waltid.client.WscaClient
import nl.harrykodden.secdsa.waltid.config.WscaConfig
import nl.harrykodden.secdsa.waltid.key.SECDSAKey
import java.util.Base64

@Serializable
data class SecdsaUnlockRequest(
    val accountId: String,
    val pin: String,
)

@Serializable
data class SecdsaKeyValidity(
    val keyId: String,
    /** true = WSCA userPub matches; false = mismatch/missing; null = not SECDSA */
    val valid: Boolean?,
    val reason: String,
)

@Serializable
data class SecdsaDidValidity(
    val did: String,
    val valid: Boolean?,
    val reason: String,
)

@Serializable
data class SecdsaStatusResponse(
    val reachable: Boolean,
    val accountId: String,
    val activated: Boolean = false,
    val hasUserKey: Boolean = false,
    val backend: String? = null,
    val wscaPublicKeyHex: String? = null,
    val keys: List<SecdsaKeyValidity> = emptyList(),
    val dids: List<SecdsaDidValidity> = emptyList(),
    val error: String? = null,
)

/**
 * Educational SECDSA routes — wallet-api2 only (not shared route library).
 *
 * - POST /wallet/{walletId}/keys/secdsa/unlock
 * - GET  /wallet/{walletId}/keys/secdsa/status
 */
fun Route.registerSecdsaUnlockRoutes(
    resolver: WalletResolver,
    getAccountId: (suspend RoutingCall.() -> String?)? = null,
) {
    route("/wallet/{walletId}/keys") {
        post("/secdsa/unlock", {
            summary = "Unlock SECDSA SoftHSM account with wallet PIN"
            description =
                "Stores the PIN in process memory and activates the SoftHSM account " +
                    "so subsequent SECDSA GENKEY/SIGN succeed."
            request {
                pathParameter<String>("walletId")
                body<SecdsaUnlockRequest> {
                    required = true
                    example("SECDSA unlock") {
                        value = SecdsaUnlockRequest(accountId = "citizen-42", pin = "424242")
                    }
                }
            }
            response {
                HttpStatusCode.OK to { description = "Unlocked" }
                HttpStatusCode.BadRequest to { description = "Invalid unlock request" }
            }
        }) {
            call.resolveSecdsaWallet(resolver, getAccountId) ?: return@post
            runCatching {
                val body = call.receive<SecdsaUnlockRequest>()
                WscaClient(WscaConfig(baseUrl = wscaBaseUrl(), accountId = body.accountId)).unlock(body.pin)
            }.onSuccess {
                call.respond(HttpStatusCode.OK, mapOf("status" to "unlocked"))
            }.onFailure {
                call.respond(HttpStatusCode.BadRequest, it.localizedMessage ?: "unlock failed")
            }
        }

        get("/secdsa/status", {
            summary = "Compare wallet SECDSA keys/DIDs to live WSCA user key"
            description =
                "Cheap validity check against WSCA /api/state (userPub). No PIN. " +
                    "Detects stale keys after memory-WSCD secdsa restarts."
            request {
                pathParameter<String>("walletId")
                queryParameter<String>("accountId") { required = false }
            }
            response {
                HttpStatusCode.OK to { body<SecdsaStatusResponse>() }
            }
        }) {
            val wallet = call.resolveSecdsaWallet(resolver, getAccountId) ?: return@get
            val accountId = call.request.queryParameters["accountId"]?.takeIf { it.isNotBlank() }
                ?: System.getenv("WSCA_ACCOUNT_ID")
                ?: "citizen-42"
            call.respond(buildSecdsaStatus(wallet, accountId))
        }
    }
}

private fun wscaBaseUrl(): String =
    System.getenv("WSCA_BASE_URL") ?: "http://secdsa:8080"

private suspend fun RoutingCall.resolveSecdsaWallet(
    resolver: WalletResolver,
    getAccountId: (suspend RoutingCall.() -> String?)?,
): Wallet? {
    val walletId = parameters["walletId"]
        ?: run {
            respond(HttpStatusCode.BadRequest, "Missing walletId path parameter")
            return null
        }
    if (getAccountId != null) {
        val accountId = getAccountId()
        if (accountId != null) {
            val ownedIds = resolver.getWalletIdsForAccount(accountId) ?: emptyList()
            if (walletId !in ownedIds) {
                respond(HttpStatusCode.Forbidden, "Wallet '$walletId' does not belong to this account")
                return null
            }
        }
    }
    return resolver.resolveWallet(walletId)
        ?: run {
            respond(HttpStatusCode.NotFound, "Wallet '$walletId' not found")
            null
        }
}

private suspend fun buildSecdsaStatus(wallet: Wallet, accountId: String): SecdsaStatusResponse {
    val client = WscaClient(WscaConfig(baseUrl = wscaBaseUrl(), accountId = accountId))
    val keyInfos = wallet.listAllKeys()
    val didEntries = wallet.didStore?.listDidsAsList().orEmpty()

    if (!client.health()) {
        return SecdsaStatusResponse(
            reachable = false,
            accountId = accountId,
            error = "WSCA unreachable at ${wscaBaseUrl()}",
            keys = keyInfos.map { SecdsaKeyValidity(it.keyId, null, "WSCA unreachable") },
            dids = didEntries.map { SecdsaDidValidity(it.did, null, "WSCA unreachable") },
        )
    }

    val snapshot = runCatching { client.readAccountSnapshot() }.getOrElse { e ->
        return SecdsaStatusResponse(
            reachable = false,
            accountId = accountId,
            error = e.message ?: "Failed to read WSCA state",
            keys = keyInfos.map { SecdsaKeyValidity(it.keyId, null, "WSCA error") },
            dids = didEntries.map { SecdsaDidValidity(it.did, null, "WSCA error") },
        )
    }

    val wscaPub = snapshot.userPubHex?.lowercase()

    val keyStatuses = keyInfos.map { info ->
        when (val key = wallet.findKey(info.keyId)) {
            is SECDSAKey -> {
                val stored = WscaClient.bytesToHex(key.getPublicKeyRepresentation()).lowercase()
                when {
                    !snapshot.hasUserKey || wscaPub == null -> SecdsaKeyValidity(
                        info.keyId,
                        false,
                        "No user key in WSCA (regenerate after secdsa restart)",
                    )
                    stored == wscaPub -> SecdsaKeyValidity(info.keyId, true, "Matches WSCA userPub")
                    else -> SecdsaKeyValidity(
                        info.keyId,
                        false,
                        "Public key differs from WSCA (stale after secdsa restart?)",
                    )
                }
            }
            else -> SecdsaKeyValidity(info.keyId, null, "Not a SECDSA key")
        }
    }

    val didStatuses = didEntries.map { entry ->
        val did = entry.did
        val didPub = when {
            did.startsWith("did:jwk:") -> runCatching { didJwkToUncompressedHex(did) }.getOrNull()
            else -> jwkFromDidDocument(entry.document)
        }?.lowercase()

        when {
            didPub == null && !did.startsWith("did:jwk:") ->
                SecdsaDidValidity(did, null, "No comparable JWK in DID document")
            didPub == null ->
                SecdsaDidValidity(did, false, "Could not decode did:jwk")
            !snapshot.hasUserKey || wscaPub == null ->
                SecdsaDidValidity(did, false, "No user key in WSCA")
            didPub == wscaPub ->
                SecdsaDidValidity(did, true, "Matches WSCA userPub")
            else ->
                SecdsaDidValidity(did, false, "Public key differs from WSCA")
        }
    }

    return SecdsaStatusResponse(
        reachable = true,
        accountId = accountId,
        activated = snapshot.activated,
        hasUserKey = snapshot.hasUserKey,
        backend = snapshot.backend,
        wscaPublicKeyHex = snapshot.userPubHex,
        keys = keyStatuses,
        dids = didStatuses,
    )
}

private val json = Json { ignoreUnknownKeys = true }

private fun didJwkToUncompressedHex(did: String): String {
    val encoded = did.removePrefix("did:jwk:")
    val bytes = Base64.getUrlDecoder().decode(padB64Url(encoded))
    val obj = json.parseToJsonElement(bytes.decodeToString()).jsonObject
    val x = obj["x"]?.jsonPrimitive?.content ?: error("did:jwk missing x")
    val y = obj["y"]?.jsonPrimitive?.content ?: error("did:jwk missing y")
    return jwkCoordsToUncompressedHex(x, y)
}

private fun jwkFromDidDocument(document: JsonObject): String? {
    val vms = document["verificationMethod"]?.jsonArray ?: return null
    for (vm in vms) {
        val jwk = vm.jsonObject["publicKeyJwk"]?.jsonObject ?: continue
        val x = jwk["x"]?.jsonPrimitive?.content ?: continue
        val y = jwk["y"]?.jsonPrimitive?.content ?: continue
        return jwkCoordsToUncompressedHex(x, y)
    }
    return null
}

private fun jwkCoordsToUncompressedHex(xB64: String, yB64: String): String {
    val x = Base64.getUrlDecoder().decode(padB64Url(xB64))
    val y = Base64.getUrlDecoder().decode(padB64Url(yB64))
    require(x.size <= 32 && y.size <= 32)
    val xb = ByteArray(32 - x.size) + x
    val yb = ByteArray(32 - y.size) + y
    return "04" + xb.toHex() + yb.toHex()
}

private fun padB64Url(s: String): String = s + "=".repeat((4 - s.length % 4) % 4)

private fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }
