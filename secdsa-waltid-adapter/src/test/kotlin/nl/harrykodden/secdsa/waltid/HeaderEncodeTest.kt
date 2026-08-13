package nl.harrykodden.secdsa.waltid

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class HeaderEncodeTest {
    @Test
    fun mapEncodeVsJsonObject() {
        val headers = buildJsonObject {
            put("typ", "openid4vci-proof+jwt")
            put("alg", "ES256")
            put("kid", "did:jwk:abc#0")
        }
        val headerMap = LinkedHashMap<String, JsonElement>().apply {
            put("alg", JsonPrimitive("ES256"))
            put("typ", JsonPrimitive("JWT"))
            putAll(headers)
        }
        val asMap = Json.encodeToString(headerMap)
        val asObj = Json.encodeToString(JsonObject(headerMap))
        println("MAP=$asMap")
        println("OBJ=$asObj")
        // Map encoding of JsonElement values often double-encodes strings as JSON strings with quotes
        assertTrue(asObj.contains("openid4vci-proof+jwt"))
        assertFalse(asMap.contains("\\\"typ\\\"") || asMap.startsWith("{\\\"alg\\\""), "map encode looked escaped: $asMap")
    }
}
