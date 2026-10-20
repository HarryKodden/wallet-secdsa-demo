package id.walt.openid4vp.clientidprefix

import id.walt.did.dids.DidService
import id.walt.openid4vp.clientidprefix.prefixes.DecentralizedIdentifier
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertTrue

/**
 * SURF OIDF now publishes did.json (and JWKS). Resolution must return verifier keys
 * whether DidService succeeds or the JWKS fallback path is used.
 */
class DidServiceResolveProbeTest {
    @Test
    fun `SURF did web resolve returns verifier keys`() = runBlocking {
        DidService.minimalInit()
        val did = "did:web:verifier.poc2.dev.oidf.lab.surfconext.nl"

        // Preferred path: did.json (restored on the SURF verifier).
        val didKeys = runCatching { DidService.resolveToKeys(did).getOrThrow() }.getOrNull()
        if (didKeys != null) {
            assertTrue(didKeys.isNotEmpty(), "DidService returned empty key set")
        }

        // Wallet path: always succeed via DID and/or JWKS fallback.
        val keys = DecentralizedIdentifier.resolveVerificationKeys(did)
        assertTrue(keys.isNotEmpty(), "expected verifier keys from DID and/or JWKS")
        assertTrue(
            keys.any { it.getKeyId().contains("verifier-poc2") },
            "expected SURF verifier kid, got ${keys.map { it.getKeyId() }}",
        )
    }
}
