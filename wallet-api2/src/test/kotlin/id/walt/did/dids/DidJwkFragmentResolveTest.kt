package id.walt.did.dids

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertTrue

class DidJwkFragmentResolveTest {

    @Test
    fun `did jwk with verification-method fragment resolves`() = runBlocking {
        DidService.minimalInit()
        val jwk =
            """{"kty":"EC","crv":"P-256","x":"MKBCTNIcKUSDii11ySs3526iDZ8AiTo7Tu6KPAqv7D4","y":"4Etl6SRW2YiLUrN5vfvVHuhp7x8PxltmWWlbbM4IFyM"}"""
        val did = "did:jwk:" +
            java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString(jwk.toByteArray())
        val didUrl = "$did#0"

        val doc = DidService.resolve(didUrl).getOrThrow()
        assertTrue(doc.isNotEmpty(), "expected DID document for $didUrl")

        val key = DidService.resolveToKey(didUrl).getOrThrow()
        assertTrue(key.getKeyId().isNotBlank())
    }
}
