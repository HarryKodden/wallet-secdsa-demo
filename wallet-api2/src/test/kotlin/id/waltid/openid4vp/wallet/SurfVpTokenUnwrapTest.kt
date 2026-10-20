package id.waltid.openid4vp.wallet

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SurfVpTokenUnwrapTest {
    @Test
    fun `unwraps single DCQL presentation string`() {
        val sdJwt = "eyJhbGciOiJFUzI1NiJ9.eyJpc3MiOiJ4In0.sig~kb"
        val dcql = """{"example_sd_jwt":["$sdJwt"]}"""
        assertEquals(sdJwt, WalletPresentFunctionality2.unwrapSingleDcqlVpToken(dcql))
    }

    @Test
    fun `leaves bare SD-JWT and multi-query maps alone`() {
        assertNull(WalletPresentFunctionality2.unwrapSingleDcqlVpToken("eyJhbGciOiJFUzI1NiJ9.e30.sig~"))
        assertNull(
            WalletPresentFunctionality2.unwrapSingleDcqlVpToken(
                """{"a":["x"],"b":["y"]}""",
            ),
        )
        assertNull(
            WalletPresentFunctionality2.unwrapSingleDcqlVpToken(
                """{"example_sd_jwt":["one","two"]}""",
            ),
        )
    }

    @Test
    fun `detects SURF JWT-parse rejection of DCQL map`() {
        val body =
            """{"error":"invalid_request","error_description":"JWT verification failed: token is malformed: could not base64 decode header: illegal base64 data at input byte 0"}"""
        assertTrue(WalletPresentFunctionality2.verifierRejectedDcqlVpTokenMap(body))
    }
}
