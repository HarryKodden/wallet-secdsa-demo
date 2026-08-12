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
    }
}
