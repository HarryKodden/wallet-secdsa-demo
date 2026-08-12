package id.walt.wallet2.handlers

import id.walt.credentials.formats.W3C2
import id.walt.credentials.signatures.JwtCredentialSignature
import id.walt.credentials.signatures.SdJwtCredentialSignature
import id.walt.dcql.DcqlMatcher
import id.walt.dcql.RawDcqlCredential
import id.walt.dcql.models.CredentialFormat
import id.walt.dcql.models.CredentialQuery
import id.walt.dcql.models.DcqlQuery
import id.walt.dcql.models.meta.JwtVcJsonMeta
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Pins Chapter F overlays: stock 0.23.1 W3C+SD-JWT reports `jwt_vc_json`,
 * eduWallet DCQL asks for `vc+sd-jwt` / `dc+sd-jwt`.
 */
class OpenId4VpDcqlFormatTest {

    private fun academicTypes() = JsonArray(
        listOf(
            JsonPrimitive("VerifiableCredential"),
            JsonPrimitive("AcademicBaseCredential"),
        ),
    )

    private fun eduWalletDcqlQuery() = DcqlQuery(
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

    @Test
    fun `W3C SD-JWT with vc+sd-jwt typ maps for DCQL`() {
        val credential = W3C2(
            credentialData = buildJsonObject { put("type", "GenericCredential") },
            signature = SdJwtCredentialSignature(
                signature = "sig",
                jwtHeader = buildJsonObject {
                    put("alg", "ES256")
                    put("typ", "vc+sd-jwt")
                },
            ),
            signed = "a.b.c",
        )
        assertEquals("jwt_vc_json", credential.format)
        assertEquals("vc+sd-jwt", credential.openId4VpDcqlFormat())
    }

    @Test
    fun `W3C SD-JWT with dc+sd-jwt typ maps for DCQL`() {
        val credential = W3C2(
            credentialData = buildJsonObject { put("type", "GenericCredential") },
            signature = SdJwtCredentialSignature(
                signature = "sig",
                jwtHeader = buildJsonObject { put("typ", "dc+sd-jwt") },
            ),
            signed = "a.b.c",
        )
        assertEquals("dc+sd-jwt", credential.openId4VpDcqlFormat())
    }

    @Test
    fun `W3C SD-JWT without typ defaults to legacy vc+sd-jwt`() {
        val credential = W3C2(
            credentialData = buildJsonObject { put("type", "GenericCredential") },
            signature = SdJwtCredentialSignature(
                signature = "sig",
                jwtHeader = buildJsonObject { put("alg", "ES256") },
            ),
            signed = "a.b.c",
        )
        assertEquals("vc+sd-jwt", credential.openId4VpDcqlFormat())
    }

    @Test
    fun `plain JWT W3C keeps jwt_vc_json`() {
        val credential = W3C2(
            credentialData = buildJsonObject { put("type", "GenericCredential") },
            signature = JwtCredentialSignature(
                signature = "sig",
                jwtHeader = buildJsonObject { put("alg", "ES256") },
            ),
            signed = "a.b.c",
        )
        assertEquals("jwt_vc_json", credential.openId4VpDcqlFormat())
    }

    @Test
    fun `eduWallet DCQL matches remapped W3C SD-JWT format`() {
        val credential = W3C2(
            credentialData = buildJsonObject { put("type", academicTypes()) },
            signature = SdJwtCredentialSignature(
                signature = "sig",
                jwtHeader = buildJsonObject { put("typ", "vc+sd-jwt") },
            ),
            signed = "a.b.c",
        )
        val raw = RawDcqlCredential(
            id = "1",
            format = credential.openId4VpDcqlFormat(),
            data = credential.credentialData,
            originalCredential = credential,
        )
        val matches = DcqlMatcher.match(eduWalletDcqlQuery(), listOf(raw))
        assertTrue(matches.isSuccess)
        assertEquals(1, matches.getOrThrow().size)
    }

    @Test
    fun `stock jwt_vc_json format without remap fails eduWallet DCQL`() {
        val credential = W3C2(
            credentialData = buildJsonObject { put("type", academicTypes()) },
            signature = SdJwtCredentialSignature(
                signature = "sig",
                jwtHeader = buildJsonObject { put("typ", "vc+sd-jwt") },
            ),
            signed = "a.b.c",
        )
        // Simulate stock behaviour: use credential.format (jwt_vc_json), not openId4VpDcqlFormat()
        val raw = RawDcqlCredential(
            id = "1",
            format = credential.format,
            data = credential.credentialData,
            originalCredential = credential,
        )
        val matches = DcqlMatcher.match(eduWalletDcqlQuery(), listOf(raw))
        assertTrue(matches.isSuccess)
        assertEquals(
            0,
            matches.getOrThrow().size,
            "Without format remap, vc+sd-jwt DCQL must not match jwt_vc_json",
        )
    }

    @Test
    fun `DC_SD_JWT format ids include legacy vc+sd-jwt`() {
        assertTrue("vc+sd-jwt" in CredentialFormat.DC_SD_JWT.id)
        assertTrue("dc+sd-jwt" in CredentialFormat.DC_SD_JWT.id)
        assertTrue("vc-sd_jwt" in CredentialFormat.DC_SD_JWT.id)
    }
}
