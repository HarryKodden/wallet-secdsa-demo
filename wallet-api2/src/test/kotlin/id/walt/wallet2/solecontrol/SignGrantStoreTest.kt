package id.walt.wallet2.solecontrol

import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFails
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SignGrantStoreTest {

    @BeforeTest
    fun clear() {
        SignGrantStore.clearAll()
    }

    @Test
    fun `mint and consume once`() {
        val grant = SignGrantStore.mint(
            walletId = "w1",
            accountId = "a1",
            keyId = "secdsa:a1:1",
            purpose = SignGrantPurpose.issuance,
            pin = "424242",
        )
        assertTrue(SignGrantStore.hasActiveGrant("w1", "a1"))
        val used = SignGrantStore.consume(grant.id, "w1", "secdsa:a1:1", SignGrantPurpose.issuance)
        assertEquals(grant.id, used.id)
        assertEquals("424242", used.pin)
        assertFalse(SignGrantStore.hasActiveGrant("w1", "a1"))
        assertFails {
            SignGrantStore.consume(grant.id, "w1", "secdsa:a1:1", SignGrantPurpose.issuance)
        }
    }

    @Test
    fun `wrong purpose rejected`() {
        val grant = SignGrantStore.mint(
            walletId = "w1",
            accountId = "a1",
            keyId = "secdsa:a1:1",
            purpose = SignGrantPurpose.presentation,
        )
        assertFails {
            SignGrantStore.consume(grant.id, "w1", "secdsa:a1:1", SignGrantPurpose.issuance)
        }
    }

    @Test
    fun `soft binding enforced when expected provided`() {
        val grant = SignGrantStore.mint(
            walletId = "w1",
            accountId = "a1",
            keyId = "secdsa:a1:1",
            purpose = SignGrantPurpose.issuance,
            binding = SignGrantBinding(clientId = "wallet-secdsa-demo"),
        )
        assertFails {
            SignGrantStore.consume(
                grant.id,
                "w1",
                "secdsa:a1:1",
                SignGrantPurpose.issuance,
                expectedBinding = SignGrantBinding(clientId = "other-client"),
            )
        }
        // Grant remains after binding mismatch (not consumed).
        assertTrue(SignGrantStore.hasActiveGrant("w1", "a1"))
        val used = SignGrantStore.consume(
            grant.id,
            "w1",
            "secdsa:a1:1",
            SignGrantPurpose.issuance,
            expectedBinding = SignGrantBinding(clientId = "wallet-secdsa-demo"),
        )
        assertEquals(grant.id, used.id)
    }

    @Test
    fun `soft binding skipped when expected is null`() {
        val grant = SignGrantStore.mint(
            walletId = "w1",
            accountId = "a1",
            keyId = "secdsa:a1:1",
            purpose = SignGrantPurpose.presentation,
            binding = SignGrantBinding(clientId = "verifier-x"),
        )
        val used = SignGrantStore.consume(grant.id, "w1", "secdsa:a1:1", SignGrantPurpose.presentation)
        assertEquals(grant.id, used.id)
    }
}
