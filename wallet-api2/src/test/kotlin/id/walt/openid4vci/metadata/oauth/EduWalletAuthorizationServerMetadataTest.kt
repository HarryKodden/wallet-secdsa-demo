package id.walt.openid4vci.metadata.oauth

import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals

class EduWalletAuthorizationServerMetadataTest {

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `parses eduWallet sandbox token-only authorization server metadata`() {
        val raw = """
            {
              "issuer": "https://agent.dev.eduwallet.nl/sandbox",
              "token_endpoint": "https://agent.dev.eduwallet.nl/sandbox/token",
              "response_types_supported": ["token"]
            }
        """.trimIndent()

        val metadata = json.decodeFromString(AuthorizationServerMetadata.serializer(), raw)

        assertEquals("https://agent.dev.eduwallet.nl/sandbox", metadata.issuer)
        assertEquals("https://agent.dev.eduwallet.nl/sandbox/token", metadata.tokenEndpoint)
        assertEquals(setOf("token"), metadata.responseTypesSupported)
        // Token-only sandbox AS: no authorization_endpoint (stock 0.23.1 rejected this).
        assertEquals(null, metadata.authorizationEndpoint)
    }

    @Test
    fun `parses AS metadata that also omits grant_types_supported`() {
        val raw = """
            {
              "issuer": "https://agent.dev.eduwallet.nl/sandbox",
              "token_endpoint": "https://agent.dev.eduwallet.nl/sandbox/token",
              "response_types_supported": ["token"],
              "jwks_uri": "https://agent.dev.eduwallet.nl/sandbox/jwks"
            }
        """.trimIndent()

        val metadata = json.decodeFromString(AuthorizationServerMetadata.serializer(), raw)
        assertEquals(null, metadata.authorizationEndpoint)
        assertEquals("https://agent.dev.eduwallet.nl/sandbox/jwks", metadata.jwksUri)
    }

    @Test
    fun `parses SURFconext AS metadata that lists JWT auth methods without signing algs`() {
        val raw = """
            {
              "issuer": "https://surfconext.poc2.dev.oidf.lab.surfconext.nl",
              "authorization_endpoint": "https://surfconext.poc2.dev.oidf.lab.surfconext.nl/authorize",
              "token_endpoint": "https://surfconext.poc2.dev.oidf.lab.surfconext.nl/token",
              "jwks_uri": "https://surfconext.poc2.dev.oidf.lab.surfconext.nl/.well-known/jwks.json",
              "response_types_supported": ["code"],
              "grant_types_supported": ["authorization_code"],
              "token_endpoint_auth_methods_supported": [
                "client_secret_basic",
                "client_secret_post",
                "client_secret_jwt",
                "private_key_jwt"
              ]
            }
        """.trimIndent()

        val metadata = json.decodeFromString(AuthorizationServerMetadata.serializer(), raw)
        assertEquals("https://surfconext.poc2.dev.oidf.lab.surfconext.nl/token", metadata.tokenEndpoint)
        assertEquals(null, metadata.tokenEndpointAuthSigningAlgValuesSupported)
    }

    @Test
    fun `parses SURF OIDF lab pre-authorized token-only AS without response_types`() {
        val raw = """
            {
              "grant_types_supported": ["urn:ietf:params:oauth:grant-type:pre-authorized_code"],
              "issuer": "https://issuer.poc2.dev.oidf.lab.surfconext.nl",
              "pre-authorized_grant_anonymous_access_supported": false,
              "token_endpoint": "https://issuer.poc2.dev.oidf.lab.surfconext.nl/token"
            }
        """.trimIndent()

        val metadata = json.decodeFromString(AuthorizationServerMetadata.serializer(), raw)
        assertEquals("https://issuer.poc2.dev.oidf.lab.surfconext.nl/token", metadata.tokenEndpoint)
        assertEquals(
            setOf("urn:ietf:params:oauth:grant-type:pre-authorized_code"),
            metadata.grantTypesSupported,
        )
        assertEquals(setOf("token"), metadata.responseTypesSupported)
        assertEquals(false, metadata.preAuthorizedGrantAnonymousAccessSupported)
    }
}
