package id.walt.wallet2.solecontrol

import kotlin.test.BeforeTest
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SoleControlRateLimitTest {

    @BeforeTest
    fun clear() {
        SoleControlRateLimit.clearAll()
        SoleControlRateLimit.authorizeMax = 3
        SoleControlRateLimit.pinFailMax = 2
        SoleControlRateLimit.windowMs = 60_000L
    }

    @Test
    fun `authorize rate limit trips after max`() {
        assertTrue(SoleControlRateLimit.allowAuthorize("a1"))
        SoleControlRateLimit.recordAuthorize("a1")
        SoleControlRateLimit.recordAuthorize("a1")
        SoleControlRateLimit.recordAuthorize("a1")
        assertFalse(SoleControlRateLimit.allowAuthorize("a1"))
        assertTrue(SoleControlRateLimit.allowAuthorize("a2"))
    }

    @Test
    fun `pin fail rate limit trips after max`() {
        assertTrue(SoleControlRateLimit.allowPinAttempt("a1"))
        SoleControlRateLimit.recordPinFail("a1")
        SoleControlRateLimit.recordPinFail("a1")
        assertFalse(SoleControlRateLimit.allowPinAttempt("a1"))
    }
}
