package id.walt.openid4vp.clientidprefix

import id.walt.openid4vp.clientidprefix.prefixes.DecentralizedIdentifier
import id.walt.openid4vp.clientidprefix.prefixes.Unsupported
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

class ClientIdPrefixParserTest {

    @Test
    fun `bare did client_id is DecentralizedIdentifier (DIIP did scheme)`() {
        val did = "did:web:verifier.example.com"
        val parsed = ClientIdPrefixParser.parse(did).getOrThrow()
        val di = assertIs<DecentralizedIdentifier>(parsed)
        assertEquals(did, di.did)
        assertEquals(did, di.rawValue)
    }

    @Test
    fun `decentralized_identifier prefix still works`() {
        val raw = "decentralized_identifier:did:jwk:eyJhbGciOiJFUzI1NiJ9"
        val parsed = ClientIdPrefixParser.parse(raw).getOrThrow()
        val di = assertIs<DecentralizedIdentifier>(parsed)
        assertEquals("did:jwk:eyJhbGciOiJFUzI1NiJ9", di.did)
        assertEquals(raw, di.rawValue)
    }

    @Test
    fun `unknown prefix stays Unsupported`() {
        val parsed = ClientIdPrefixParser.parse("origin:https://example.com").getOrThrow()
        assertIs<Unsupported>(parsed)
    }

    @Test
    fun `did is advertised as a supported prefix value`() {
        assertTrue(ClientIdPrefix.entries.any { it.value == "did" })
        assertTrue(ClientIdPrefix.entries.any { it.value == "decentralized_identifier" })
    }
}
