package id.walt.openid4vp.clientidprefix

import id.walt.crypto.utils.JwsUtils.decodeJws
import id.walt.dcql.models.meta.NoMeta
import id.walt.did.dids.DidService
import id.walt.openid4vp.clientidprefix.prefixes.DecentralizedIdentifier
import id.walt.verifier.openid.models.authorization.AuthorizationRequest
import id.walt.verifier.openid.models.authorization.ClientMetadata
import io.ktor.client.HttpClient
import io.ktor.client.engine.java.Java
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/**
 * SURF OIDF presentation requests omit DCQL `meta`. Resolve must still authenticate
 * (DID and/or JWKS) and decode the authorization request.
 */
class SurfAuthzDecodeTest {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }
    private val verifierBase = "https://verifier.poc2.dev.oidf.lab.surfconext.nl"

    @Test
    fun `SURF request JWT verifies and decodes without dcql meta`() = runBlocking {
        DidService.minimalInit()
        val http = HttpClient(Java)
        try {
            val home = http.get("$verifierBase/").bodyAsText()
            val requestId = Regex("""/oid4vp/request/([A-Za-z0-9_-]+)""")
                .find(home)
                ?.groupValues
                ?.get(1)
                ?: fail("no live /oid4vp/request/{id} on SURF verifier homepage")

            val jws = http.get("$verifierBase/oid4vp/request/$requestId").bodyAsText().trim()
            require(jws.count { it == '.' } >= 2) { "expected request JWT, got: ${jws.take(80)}" }

            val payload = jws.decodeJws().payload
            val kid = jws.decodeJws().header["kid"]!!.jsonPrimitive.content
            val did = "did:web:verifier.poc2.dev.oidf.lab.surfconext.nl"

            val keys = DecentralizedIdentifier.resolveVerificationKeys(did)
            val key = DecentralizedIdentifier.selectVerificationKey(keys, did, kid)
                ?: fail("no key for kid=$kid")
            assertTrue(key.verifyJws(jws).isSuccess)

            val authReq = json.decodeFromJsonElement(AuthorizationRequest.serializer(), payload)
            assertEquals("example_sd_jwt", authReq.dcqlQuery!!.credentials.single().id)
            assertTrue(authReq.dcqlQuery!!.credentials.single().meta is NoMeta)

            val meta = ClientMetadata.fromJson(payload["client_metadata"]!!).getOrThrow()
            val ctx = RequestContext(
                clientId = payload["client_id"]!!.jsonPrimitive.content,
                clientMetadata = meta,
                requestObjectJws = jws,
                responseUri = payload["response_uri"]?.jsonPrimitive?.content,
            )
            when (val r = ClientIdPrefixAuthenticator.authenticate(
                ClientIdPrefixParser.parse(ctx.clientId!!).getOrThrow(),
                ctx,
            )) {
                is ClientValidationResult.Success -> Unit
                is ClientValidationResult.Failure -> fail("AUTH FAIL: ${r.error}")
            }
        } finally {
            http.close()
        }
    }
}
