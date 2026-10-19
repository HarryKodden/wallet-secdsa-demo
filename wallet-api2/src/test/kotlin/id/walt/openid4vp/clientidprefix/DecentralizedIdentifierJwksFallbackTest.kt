package id.walt.openid4vp.clientidprefix

import id.walt.openid4vp.clientidprefix.prefixes.DecentralizedIdentifier
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class DecentralizedIdentifierJwksFallbackTest {

    @Test
    fun `didWebHttpsBase maps host-only did web`() {
        assertEquals(
            "https://verifier.poc2.dev.oidf.lab.surfconext.nl",
            DecentralizedIdentifier.didWebHttpsBase(
                "did:web:verifier.poc2.dev.oidf.lab.surfconext.nl",
            ),
        )
    }

    @Test
    fun `didWebHttpsBase maps path segments`() {
        assertEquals(
            "https://example.com/user/alice",
            DecentralizedIdentifier.didWebHttpsBase("did:web:example.com:user:alice"),
        )
    }

    @Test
    fun `didWebHttpsBase rejects non-web`() {
        assertNull(DecentralizedIdentifier.didWebHttpsBase("did:jwk:abc"))
    }

    @Test
    fun `SURF verifier JWKS fallback returns signing keys`() = runBlocking {
        val keys = DecentralizedIdentifier.resolveDidWebKeysFromVerifierJwks(
            "did:web:verifier.poc2.dev.oidf.lab.surfconext.nl",
        )
        assertTrue(keys.isNotEmpty(), "expected JWKS keys from SURF openid-credential-verifier")
        assertTrue(
            keys.any { it.getKeyId() == "verifier-poc2-dev-oidf-lab-surfconext-nl-20260320T162914Z" },
            "expected SURF verifier kid among JWKS keys",
        )
    }
}
