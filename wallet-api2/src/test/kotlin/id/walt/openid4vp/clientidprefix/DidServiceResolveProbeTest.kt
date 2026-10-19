package id.walt.openid4vp.clientidprefix

import id.walt.did.dids.DidService
import id.walt.openid4vp.clientidprefix.prefixes.DecentralizedIdentifier
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertTrue

/**
 * SURF OIDF publishes JWKS but not did.json. walt.id DidService throws on that;
 * [DecentralizedIdentifier.resolveVerificationKeys] must still return JWKS keys.
 */
class DidServiceResolveProbeTest {
    @Test
    fun `SURF did web resolve falls back to JWKS when DidService throws`() = runBlocking {
        DidService.minimalInit()
        val did = "did:web:verifier.poc2.dev.oidf.lab.surfconext.nl"
        val threw = runCatching { DidService.resolveToKeys(did) }.isFailure
        assertTrue(threw, "expected DidService to throw when did.json is missing")

        val keys = DecentralizedIdentifier.resolveVerificationKeys(did)
        assertTrue(keys.isNotEmpty(), "JWKS fallback should yield verifier keys")
        assertTrue(
            keys.any { it.getKeyId().contains("verifier-poc2") },
            "expected SURF verifier kid, got ${keys.map { it.getKeyId() }}",
        )
    }
}
