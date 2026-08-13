package id.walt.did.dids

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertTrue

class DidVerificationMethodResolverTest {

    @Test
    fun `did jwk authentication kid ends with fragment`() = runBlocking {
        DidService.minimalInit()
        // Minimal P-256 jwk (demo) — resolver only needs a parseable did:jwk document.
        val jwk =
            """{"kty":"EC","crv":"P-256","x":"MKBCTNIcKUSDii11ySs3526iDZ8AiTo7Tu6KPAqv7D4","y":"4Etl6SRW2YiLUrN5vfvVHuhp7x8PxltmWWlbbM4IFyM"}"""
        val did = "did:jwk:" +
            java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString(jwk.toByteArray())
        val kid = DidVerificationMethodResolver.authenticationKid(did)
        assertTrue(kid.startsWith(did), "kid should be a DID URL under $did, got $kid")
        assertTrue(kid.contains("#"), "kid should include a fragment, got $kid")
    }
}
