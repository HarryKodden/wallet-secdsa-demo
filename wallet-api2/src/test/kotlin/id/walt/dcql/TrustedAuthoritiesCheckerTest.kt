package id.walt.dcql

import id.walt.dcql.models.TrustedAuthoritiesQuery
import id.walt.dcql.models.TrustedAuthorityType
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class TrustedAuthoritiesCheckerTest {

    private fun cred(issuer: String): RawDcqlCredential =
        RawDcqlCredential(
            id = "1",
            format = "jwt_vc_json",
            data = buildJsonObject {
                put("iss", issuer)
                put("vct", "https://example.com/vct")
            },
        )

    @Test
    fun `openid_federation allows matching issuer DID`() {
        val issuer = "did:web:issuer.example"
        assertTrue(
            TrustedAuthoritiesChecker.matches(
                cred(issuer),
                listOf(
                    TrustedAuthoritiesQuery(
                        type = TrustedAuthorityType.OPENID_FEDERATION,
                        values = listOf(issuer),
                    ),
                ),
            ),
        )
    }

    @Test
    fun `openid_federation rejects foreign issuer`() {
        assertFalse(
            TrustedAuthoritiesChecker.matches(
                cred("did:web:other.example"),
                listOf(
                    TrustedAuthoritiesQuery(
                        type = TrustedAuthorityType.OPENID_FEDERATION,
                        values = listOf("did:web:issuer.example"),
                    ),
                ),
            ),
        )
    }
}
