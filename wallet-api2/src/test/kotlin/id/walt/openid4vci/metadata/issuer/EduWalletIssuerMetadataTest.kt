package id.walt.openid4vci.metadata.issuer

import id.walt.openid4vci.CredentialFormat
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals

class EduWalletIssuerMetadataTest {

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `parses eduWallet-style issuer metadata with vc+sd-jwt alias and invalid ldp_vc`() {
        val raw = """
            {
              "credential_issuer": "https://issuer.example/sandbox",
              "credential_endpoint": "https://issuer.example/sandbox/credentials",
              "credential_configurations_supported": {
                "ok_sd": {
                  "format": "dc+sd-jwt",
                  "vct": "https://example.com/vct"
                },
                "legacy_sd": {
                  "format": "vc+sd-jwt",
                  "vct": "https://example.com/vct-legacy"
                },
                "generic_jwt": {
                  "format": "vc+sd-jwt",
                  "credential_definition": { "type": ["VerifiableCredential", "GenericCredential"] },
                  "credential_metadata": {
                    "display": [{ "locale": "en", "name": "Generic" }],
                    "claims": []
                  },
                  "credential_signing_alg_values_supported": ["ES256"]
                },
                "bad_ld": {
                  "format": "ldp_vc",
                  "credential_signing_alg_values_supported": ["ES256"],
                  "credential_definition": { "type": ["VerifiableCredential"] }
                }
              }
            }
        """.trimIndent()

        val metadata = json.decodeFromString(CredentialIssuerMetadata.serializer(), raw)

        assertEquals(
            setOf("ok_sd", "legacy_sd", "generic_jwt"),
            metadata.credentialConfigurationsSupported.keys,
        )
        assertEquals(CredentialFormat.SD_JWT_VC, metadata.credentialConfigurationsSupported["legacy_sd"]?.format)
        assertEquals(CredentialFormat.SD_JWT_VC, metadata.credentialConfigurationsSupported["generic_jwt"]?.format)
    }
}
