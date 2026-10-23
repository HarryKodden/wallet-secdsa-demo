package id.walt.openid4vp.clientidprefix

import id.walt.openid4vp.clientidprefix.prefixes.OpenIdFederation
import id.waltid.openid4vp.wallet.request.AuthorizationRequestResolver
import io.ktor.http.Url
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * Sphereon Summa uses `client_id=openid_federation:https://…/oid4vp/summa` and
 * sometimes emits a doubled `openid4vp://?openid4vp://?…` deep link.
 */
class OpenIdFederationSphereonTest {
    private val entityId = "https://summa.fed.nk.sphereon.com/oid4vp/summa"

    @Test
    fun `doubled openid4vp deep link recovers client_id`() {
        val mangled = Url(
            "openid4vp://?openid4vp://?" +
                "client_id=openid_federation%3Ahttps%3A%2F%2Fsumma.fed.nk.sphereon.com%2Foid4vp%2Fsumma&" +
                "request_uri=https%3A%2F%2Fsumma.fed.nk.sphereon.com%2Foid4vp%2Fsumma%2Foid4vp%2Frequest-uri%2Fcfqu77bMP2S6fcCbnoVeNQ",
        )
        assertTrue(mangled.parameters["client_id"].isNullOrBlank(), "precondition: client_id mangled")
        assertTrue(!mangled.parameters["request_uri"].isNullOrBlank(), "precondition: request_uri intact")

        val fixed = AuthorizationRequestResolver.normalizePresentationRequestUrl(mangled)
        assertEquals(
            "openid_federation:https://summa.fed.nk.sphereon.com/oid4vp/summa",
            fixed.parameters["client_id"],
        )
        assertTrue(fixed.parameters["request_uri"]!!.contains("request-uri"))
    }

    @Test
    fun `Sphereon entity configuration yields verifier JWKS`() = runBlocking {
        val payload = OpenIdFederation.fetchEntityConfigurationPayload(entityId)
        assertEquals(
            entityId,
            payload["sub"]!!.jsonPrimitive.content,
        )
        val jwks = OpenIdFederation.extractVerifierJwks(payload)
        assertTrue(jwks.isNotEmpty(), "expected openid_credential_verifier.jwks")
        val keys = OpenIdFederation.importKeys(jwks)
        assertTrue(keys.isNotEmpty(), "failed to import verifier keys")
        assertTrue(keys.any { it.getKeyId().isNotBlank() })
    }

    @Test
    fun `openid_federation client_id builds client_metadata from entity`() =
        runBlocking {
            val clientId = ClientIdPrefixParser.parse(
                "openid_federation:$entityId",
            ).getOrElse { fail(it.message) }
            val federation = clientId as? OpenIdFederation
                ?: fail("expected OpenIdFederation, got ${clientId::class.simpleName}")
            assertEquals(entityId, federation.entityId)

            val entityPayload = OpenIdFederation.fetchEntityConfigurationPayload(entityId)
            val meta = OpenIdFederation.clientMetadataFromEntity(entityPayload, fallback = null)
            assertTrue(
                !meta.vpFormatsSupported.isNullOrEmpty(),
                "expected vp_formats_supported from Entity Configuration",
            )
        }
}
