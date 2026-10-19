package id.walt.wallet2.solecontrol

import id.walt.wallet2.server.WalletResolver
import io.github.smiley4.ktoropenapi.post
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import nl.harrykodden.secdsa.waltid.client.WscaClient
import nl.harrykodden.secdsa.waltid.config.WscaConfig
import nl.harrykodden.secdsa.waltid.key.SECDSAKey
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

@Serializable
data class SignGrantBindingRequest(
    val offerId: String? = null,
    val requestHash: String? = null,
    val clientId: String? = null,
)

@Serializable
data class AuthorizeSignRequest(
    val accountId: String,
    val keyId: String,
    val purpose: String,
    /** SoftHSM PIN — used once to prove unlock for mint (not kept for ongoing SIGN when sole-control is on). */
    val pin: String? = null,
    val binding: SignGrantBindingRequest? = null,
    val ttlSeconds: Long? = null,
)

@Serializable
data class AuthorizeSignResponse(
    val signGrant: String,
    val purpose: String,
    val keyId: String,
    val expiresAt: String,
    val ttlSeconds: Long,
    val soleControlSigning: Boolean,
)

/**
 * `POST /wallet/{walletId}/keys/secdsa/authorize-sign`
 *
 * Always available so clients can integrate early. Enforcement of grants on
 * receive/present lands in G1–G3 when [SoleControlSigning.enabled] is true.
 */
fun Route.registerSignGrantRoutes(
    resolver: WalletResolver,
    getAccountId: (suspend RoutingCall.() -> String?)? = null,
) {
    post("/wallet/{walletId}/keys/secdsa/authorize-sign", {
        summary = "Mint a short-lived SignGrant for holder SIGN (Track G)"
        description =
            "See docs/sole-control-track-a.md. Proves SoftHSM PIN (when provided), " +
                "returns an opaque grant for issuance/presentation. Does not leave a " +
                "long-lived PIN session for arbitrary SIGN when SOLE_CONTROL_SIGNING=true."
        request {
            pathParameter<String>("walletId")
            body<AuthorizeSignRequest> { required = true }
        }
        response {
            HttpStatusCode.Created to { body<AuthorizeSignResponse>() }
            HttpStatusCode.BadRequest to { description = "Invalid request or SoftHSM unlock failed" }
            HttpStatusCode.Forbidden to { description = "Key not in wallet or not SECDSA" }
        }
    }) {
        val walletId = call.parameters["walletId"]
            ?: return@post call.respond(HttpStatusCode.BadRequest, "Missing walletId")
        if (getAccountId != null) {
            val accountId = with(call) { getAccountId() }
            if (accountId != null) {
                val owned = resolver.getWalletIdsForAccount(accountId) ?: emptyList()
                if (walletId !in owned) {
                    return@post call.respond(HttpStatusCode.Forbidden, "Wallet does not belong to this account")
                }
            }
        }
        val wallet = resolver.resolveWallet(walletId)
            ?: return@post call.respond(HttpStatusCode.NotFound, "Wallet not found")

        val body = runCatching { call.receive<AuthorizeSignRequest>() }.getOrElse {
            return@post call.respond(HttpStatusCode.BadRequest, it.message ?: "Invalid body")
        }

        val purpose = runCatching { SignGrantPurpose.parse(body.purpose) }.getOrElse {
            return@post call.respond(HttpStatusCode.BadRequest, it.message ?: "Invalid purpose")
        }

        val key = wallet.findKey(body.keyId)
            ?: return@post call.respond(HttpStatusCode.Forbidden, "Key '${body.keyId}' not in wallet")
        if (key !is SECDSAKey) {
            return@post call.respond(HttpStatusCode.Forbidden, "Key '${body.keyId}' is not a SECDSA key")
        }

        val pin = body.pin?.takeIf { it.isNotBlank() }
        if (pin == null) {
            return@post call.respond(
                HttpStatusCode.BadRequest,
                "pin required to mint SignGrant (SoftHSM unlock proof). " +
                    "WebAuthn presence is enforced by the wallet UI (G2); " +
                    "PIN may come from PRF restore or a step-up prompt.",
            )
        }

        val wscaBase = System.getenv("WSCA_BASE_URL") ?: "http://secdsa:8080"
        runCatching {
            WscaClient(WscaConfig(baseUrl = wscaBase, accountId = body.accountId)).unlock(pin)
        }.onFailure {
            return@post call.respond(HttpStatusCode.BadRequest, it.localizedMessage ?: "SoftHSM unlock failed")
        }

        // Sole-control mode: PIN was used only for mint proof — do not leave it
        // available for unrestricted SIGN via SecdsaPinSession.
        if (SoleControlSigning.enabled()) {
            nl.harrykodden.secdsa.waltid.client.SecdsaPinSession.clear(body.accountId)
        }

        val ttl = body.ttlSeconds ?: SoleControlSigning.DEFAULT_GRANT_TTL_SECONDS
        val grant = SignGrantStore.mint(
            walletId = walletId,
            accountId = body.accountId,
            keyId = body.keyId,
            purpose = purpose,
            binding = SignGrantBinding(
                offerId = body.binding?.offerId,
                requestHash = body.binding?.requestHash,
                clientId = body.binding?.clientId,
            ),
            ttlSeconds = ttl,
        )

        val expiresAt = DateTimeFormatter.ISO_INSTANT.format(grant.expiresAt.atOffset(ZoneOffset.UTC))
        call.respond(
            HttpStatusCode.Created,
            AuthorizeSignResponse(
                signGrant = grant.id,
                purpose = grant.purpose.name,
                keyId = grant.keyId,
                expiresAt = expiresAt,
                ttlSeconds = ttl,
                soleControlSigning = SoleControlSigning.enabled(),
            ),
        )
    }
}
