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
        )
        assertTrue(SignGrantStore.hasActiveGrant("w1", "a1"))
        val used = SignGrantStore.consume(grant.id, "w1", "secdsa:a1:1", SignGrantPurpose.issuance)
        assertEquals(grant.id, used.id)
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
}
