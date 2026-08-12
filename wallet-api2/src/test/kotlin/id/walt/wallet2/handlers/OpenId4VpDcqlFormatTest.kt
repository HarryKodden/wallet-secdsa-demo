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
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class OpenId4VpDcqlFormatTest {

    @Test
    fun `W3C SD-JWT with vc+sd-jwt typ maps for DCQL`() {
        val credential = W3C2(
            credentialData = buildJsonObject {
                put("type", "GenericCredential")
            },
            signature = SdJwtCredentialSignature(
                signature = "sig",
                jwtHeader = buildJsonObject {
                    put("alg", "ES256")
                    put("typ", "vc+sd-jwt")
                },
            ),
            signed = "a.b.c",
        )
        // Stock jar reports jwt_vc_json for W3C+SD-JWT
        assertEquals("jwt_vc_json", credential.format)
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
            credentialData = buildJsonObject {
                put(
                    "type",
                    kotlinx.serialization.json.JsonArray(
                        listOf(
                            kotlinx.serialization.json.JsonPrimitive("VerifiableCredential"),
                            kotlinx.serialization.json.JsonPrimitive("AcademicBaseCredential"),
                        ),
                    ),
                )
            },
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
        val matches = DcqlMatcher.match(query, listOf(raw))
        assertTrue(matches.isSuccess)
        assertEquals(1, matches.getOrThrow().size)
    }
}
