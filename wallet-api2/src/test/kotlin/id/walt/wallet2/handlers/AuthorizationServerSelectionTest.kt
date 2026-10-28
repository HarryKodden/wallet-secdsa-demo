package id.walt.wallet2.handlers

import id.walt.openid4vci.metadata.issuer.CredentialIssuerMetadata
import id.walt.openid4vci.offers.CredentialOffer
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class AuthorizationServerSelectionTest {

    private val json = Json { ignoreUnknownKeys = true }

    private val issuer = "https://issuer.example"
    private val login = "https://login.example"
    private val targeted = "https://idp-targeted.example"

    private val metadata = CredentialIssuerMetadata.fromBaseUrl(
        baseUrl = issuer,
        credentialConfigurationsSupported = emptyMap(),
        authorizationServers = listOf(issuer, login, targeted),
    )

    @Test
    fun `authorization code uses the offer authorization_server instead of authorization_servers first entry`() {
        val offer = offer(
            """
            "authorization_code": {
              "authorization_server": "$targeted"
            }
            """.trimIndent(),
        )

        assertEquals(
            targeted,
            WalletIssuanceHandler.authorizationServerForOffer(
                offer,
                metadata,
                preferPreAuthorized = false,
            ),
        )
    }

    @Test
    fun `dual grant authorization code path still uses the named authorization server`() {
        val offer = offer(
            """
            "authorization_code": {
              "authorization_server": "$targeted"
            },
            "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
              "pre-authorized_code": "one-time"
            }
            """.trimIndent(),
        )

        assertEquals(
            targeted,
            WalletIssuanceHandler.authorizationServerForOffer(
                offer,
                metadata,
                preferPreAuthorized = false,
            ),
        )
    }

    @Test
    fun `missing authorization_server leaves selection to issuer metadata`() {
        val offer = offer(
            """
            "authorization_code": {}
            """.trimIndent(),
        )

        assertNull(
            WalletIssuanceHandler.authorizationServerForOffer(
                offer,
                metadata,
                preferPreAuthorized = false,
            ),
        )
    }

    @Test
    fun `trailing slash on the offer authorization_server still matches the declared server`() {
        val offer = offer(
            """
            "authorization_code": {
              "authorization_server": "$targeted/"
            }
            """.trimIndent(),
        )

        assertEquals(
            targeted,
            WalletIssuanceHandler.authorizationServerForOffer(
                offer,
                metadata,
                preferPreAuthorized = false,
            ),
        )
    }

    @Test
    fun `authorization_server outside the issuer list is rejected`() {
        val offer = offer(
            """
            "authorization_code": {
              "authorization_server": "https://other.example"
            }
            """.trimIndent(),
        )

        assertFailsWith<IllegalStateException> {
            WalletIssuanceHandler.authorizationServerForOffer(
                offer,
                metadata,
                preferPreAuthorized = false,
            )
        }
    }

    private fun offer(grants: String): CredentialOffer =
        json.decodeFromString(
            """
            {
              "credential_issuer": "$issuer",
              "credential_configuration_ids": ["card"],
              "grants": { $grants }
            }
            """.trimIndent(),
        )
}
