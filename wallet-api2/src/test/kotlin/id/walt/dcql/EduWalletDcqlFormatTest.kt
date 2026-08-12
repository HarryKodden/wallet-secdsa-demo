package id.walt.dcql

import id.walt.dcql.models.CredentialFormat
import id.walt.dcql.models.CredentialQuery
import id.walt.dcql.models.DcqlQuery
import id.walt.dcql.models.meta.JwtVcJsonMeta
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class EduWalletDcqlFormatTest {

    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `deserializes legacy vc+sd-jwt DCQL format`() {
        assertEquals(
            CredentialFormat.DC_SD_JWT,
            json.decodeFromString(CredentialFormat.serializer(), "\"vc+sd-jwt\""),
        )
    }

    @Test
    fun `deserializes draft dc+sd-jwt DCQL format`() {
        assertEquals(
            CredentialFormat.DC_SD_JWT,
            json.decodeFromString(CredentialFormat.serializer(), "\"dc+sd-jwt\""),
        )
    }

    @Test
    fun `allows vc+sd-jwt format with W3C type_values meta`() {
        val query = DcqlQuery(
            credentials = listOf(
                CredentialQuery(
                    id = "edu",
                    format = CredentialFormat.DC_SD_JWT,
                    meta = JwtVcJsonMeta(
                        typeValues = listOf(listOf("VerifiableCredential", "AcademicBaseCredential")),
                    ),
                ),
            ),
        )
        assertEquals(CredentialFormat.DC_SD_JWT, query.credentials.first().format)
    }

    @Test
    fun `rejects jwt_vc_json format with SdJwtVc-only style mismatch via require in CredentialQuery`() {
        // DC_SD_JWT + JwtVcJsonMeta is the eduWallet legacy pairing and must be allowed.
        // JWT_VC_JSON + wrong meta shape is still validated by CredentialQuery init.
        assertFailsWith<IllegalArgumentException> {
            CredentialQuery(
                id = "bad",
                format = CredentialFormat.JWT_VC_JSON,
                meta = id.walt.dcql.models.meta.SdJwtVcMeta(
                    vctValues = listOf("https://example.com/vct"),
                ),
            )
        }
    }
}
