package id.waltid.openid4vp.wallet

import id.walt.dcql.models.CredentialFormat
import id.walt.dcql.models.CredentialQuery
import id.walt.dcql.models.CredentialSetQuery
import id.walt.dcql.models.DcqlQuery
import id.walt.dcql.models.meta.SdJwtVcMeta
import kotlin.test.Test
import kotlin.test.assertNotNull
import kotlin.test.assertNull

class CredentialAvailabilityTest {
    private fun eupidQuery() = CredentialQuery(
        id = "eupid",
        format = CredentialFormat.DC_SD_JWT,
        meta = SdJwtVcMeta(vctValues = listOf("https://example.com/EuPid")),
    )

    @Test
    fun `single matched eupid query is available`() {
        val query = DcqlQuery(credentials = listOf(eupidQuery()))
        assertNull(
            PresentationRequestValidator.validateCredentialAvailability(query, setOf("eupid")),
        )
    }

    @Test
    fun `partial match without credential_sets is denied`() {
        val query = DcqlQuery(
            credentials = listOf(
                eupidQuery(),
                eupidQuery().copy(id = "other"),
            ),
        )
        assertNotNull(
            PresentationRequestValidator.validateCredentialAvailability(query, setOf("eupid")),
        )
    }

    @Test
    fun `required credential_set option satisfied by eupid`() {
        val query = DcqlQuery(
            credentials = listOf(eupidQuery()),
            credentialSets = listOf(
                CredentialSetQuery(options = listOf(listOf("eupid")), required = true),
            ),
        )
        assertNull(
            PresentationRequestValidator.validateCredentialAvailability(query, setOf("eupid")),
        )
    }

    @Test
    fun `required credential_set not satisfied is denied`() {
        val query = DcqlQuery(
            credentials = listOf(eupidQuery()),
            credentialSets = listOf(
                CredentialSetQuery(options = listOf(listOf("eupid", "photo")), required = true),
            ),
        )
        assertNotNull(
            PresentationRequestValidator.validateCredentialAvailability(query, setOf("eupid")),
        )
    }
}
