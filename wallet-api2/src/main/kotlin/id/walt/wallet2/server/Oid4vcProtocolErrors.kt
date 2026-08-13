package id.walt.wallet2.server

import id.walt.wallet2.handlers.CredentialEndpointException
import id.waltid.openid4vp.wallet.request.AuthorizationRequestResolver
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*
import kotlinx.serialization.Serializable

/**
 * Stable OID4VCI / OID4VP style error body for wallet-api2 routes (prefer 4xx over opaque 500).
 */
@Serializable
data class ProtocolErrorBody(
    val error: String,
    val error_description: String? = null,
    val message: String? = null,
)

object Oid4vcProtocolErrors {

    fun isClientProtocolFailure(throwable: Throwable): Boolean {
        var t: Throwable? = throwable
        while (t != null) {
            when (t) {
                is CredentialEndpointException -> return true
                is IllegalArgumentException -> return true
                is AuthorizationRequestResolver.SignedAuthorizationRequestValidationException -> return true
                is AuthorizationRequestResolver.UnsignedAuthorizationRequestNotAllowedException -> return true
            }
            val msg = t.message.orEmpty()
            if (
                msg.startsWith("Token request failed") ||
                msg.contains("PAR request failed") ||
                msg.contains("PKCE") ||
                msg.contains("trusted_authorities") ||
                msg.contains("invalid_request") ||
                msg.contains("Could not parse client_id") ||
                msg.contains("Authorization Request") ||
                msg.contains("dcql_query") ||
                msg.contains("No key available") ||
                msg.contains("Credential '") && msg.contains("not found")
            ) {
                return true
            }
            t = t.cause
        }
        return false
    }

    fun toBody(throwable: Throwable): ProtocolErrorBody {
        val credentialError = (throwable as? CredentialEndpointException)?.credentialError
        if (credentialError != null) {
            val code = credentialError.error ?: "invalid_request"
            val description = credentialError.description ?: throwable.message
            return ProtocolErrorBody(
                error = code,
                error_description = description,
                message = description ?: code,
            )
        }

        val msg = throwable.message?.takeIf { it.isNotBlank() } ?: throwable::class.simpleName ?: "request_failed"
        val error = when {
            msg.startsWith("Token request failed") -> "invalid_grant"
            "PKCE" in msg -> "invalid_request"
            "PAR " in msg -> "invalid_request"
            "trusted_authorities" in msg -> "access_denied"
            "client_id" in msg -> "invalid_client"
            "dcql" in msg.lowercase() -> "invalid_request"
            throwable is IllegalArgumentException -> "invalid_request"
            else -> "invalid_request"
        }
        return ProtocolErrorBody(
            error = error,
            error_description = msg,
            message = msg,
        )
    }

    suspend fun ApplicationCall.respondProtocolFailure(throwable: Throwable) {
        respond(HttpStatusCode.BadRequest, toBody(throwable))
    }
}
