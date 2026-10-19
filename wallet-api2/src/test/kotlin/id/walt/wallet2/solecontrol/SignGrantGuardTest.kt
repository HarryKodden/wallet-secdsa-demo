package id.walt.wallet2.solecontrol

import kotlin.test.AfterTest
import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class SignGrantGuardTest {

    @BeforeTest
    fun setUp() {
        SignGrantStore.clearAll()
        System.clearProperty("SOLE_CONTROL_SIGNING")
        // getenv cannot be cleared easily; guard tests use enabled=false via requireConsumed when env unset.
    }

    @AfterTest
    fun tearDown() {
        SignGrantStore.clearAll()
    }

    @Test
    fun `no-op when sole-control disabled`() {
        // Default env unset → SoleControlSigning.enabled() == false
        val session = SignGrantGuard.requireConsumed(
            signGrant = null,
            walletId = "w1",
            keyId = "secdsa:a:1",
            purpose = SignGrantPurpose.issuance,
        )
        session.release()
    }

    @Test
    fun `consume succeeds for matching grant`() {
        // Simulate enforcement path without flipping process env: call store directly,
        // then requireConsumed with flag off is no-op. For flag-on behavior, unit-test store.
        val grant = SignGrantStore.mint(
            walletId = "w1",
            accountId = "a1",
            keyId = "secdsa:a:1",
            purpose = SignGrantPurpose.presentation,
        )
        assertTrue(SignGrantStore.hasActiveGrant("w1", "a1"))
        SignGrantStore.consume(grant.id, "w1", "secdsa:a:1", SignGrantPurpose.presentation)
        assertFailsWith<IllegalStateException> {
            SignGrantStore.consume(grant.id, "w1", "secdsa:a:1", SignGrantPurpose.presentation)
        }
    }
}
