package id.walt.dcql

import id.walt.dcql.models.CredentialFormat
import id.walt.dcql.models.CredentialQuery
import id.walt.dcql.models.DcqlQuery
import id.walt.dcql.models.meta.JwtVcJsonMeta
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals

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
}
