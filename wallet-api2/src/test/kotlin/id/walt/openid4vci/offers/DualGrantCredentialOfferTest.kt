package id.walt.openid4vci.offers

import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class DualGrantCredentialOfferTest {

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `parses SURF-style offer with both authorization_code and pre-authorized_code`() {
        val raw = """
            {
              "credential_configuration_ids": ["example_sd_jwt"],
              "credential_issuer": "https://issuer.poc2.dev.oidf.lab.surfconext.nl",
              "grants": {
                "authorization_code": {
                  "authorization_server": "https://surfconext.poc2.dev.oidf.lab.surfconext.nl"
                },
                "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
                  "pre-authorized_code": "test-pre-auth",
                  "tx_code": {
                    "description": "Enter the code shown by the credential issuer",
                    "input_mode": "numeric",
                    "length": 6
                  }
                }
              }
            }
        """.trimIndent()

        val offer = json.decodeFromString(CredentialOffer.serializer(), raw)
        assertEquals("https://issuer.poc2.dev.oidf.lab.surfconext.nl", offer.credentialIssuer)
        assertNotNull(offer.grants?.preAuthorizedCode)
        assertEquals("test-pre-auth", offer.grants?.preAuthorizedCode?.preAuthorizedCode)
        assertEquals(6, offer.grants?.preAuthorizedCode?.txCode?.length)
        assertNotNull(offer.grants?.authorizationCode)
        assertEquals(
            "https://surfconext.poc2.dev.oidf.lab.surfconext.nl",
            offer.grants?.authorizationCode?.authorizationServer,
        )
    }

    @Test
    fun `still parses pre-authorized-only offers`() {
        val raw = """
            {
              "credential_issuer": "https://issuer.example",
              "credential_configuration_ids": ["OpenBadgeCredential_jwt_vc_json"],
              "grants": {
                "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
                  "pre-authorized_code": "only-pre"
                }
              }
            }
        """.trimIndent()

        val offer = json.decodeFromString(CredentialOffer.serializer(), raw)
        assertEquals("only-pre", offer.grants?.preAuthorizedCode?.preAuthorizedCode)
        assertNull(offer.grants?.authorizationCode)
    }
}
