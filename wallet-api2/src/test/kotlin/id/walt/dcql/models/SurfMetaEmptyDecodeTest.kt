package id.walt.dcql.models

import id.walt.dcql.models.meta.NoMeta
import kotlinx.serialization.json.Json
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SurfMetaEmptyDecodeTest {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    @Test
    fun `empty meta object decodes as NoMeta`() {
        val cq = json.decodeFromString(
            CredentialQuery.serializer(),
            """{"id":"example_sd_jwt","format":"dc+sd-jwt","meta":{}}""",
        )
        assertEquals("example_sd_jwt", cq.id)
        assertTrue(cq.meta is NoMeta, "meta was ${cq.meta::class.simpleName}")
    }

    @Test
    fun `omitted meta decodes as NoMeta`() {
        val cq = json.decodeFromString(
            CredentialQuery.serializer(),
            """{"id":"example_sd_jwt","format":"dc+sd-jwt"}""",
        )
        assertTrue(cq.meta is NoMeta)
    }
}
