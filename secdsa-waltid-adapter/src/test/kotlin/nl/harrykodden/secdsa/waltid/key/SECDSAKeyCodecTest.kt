package nl.harrykodden.secdsa.waltid.key

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class SECDSAKeyCodecTest {
    @Test
    fun uncompressedToJwkRoundTripLengths() {
        val uncompressed = ByteArray(65) { 0x04 }
        uncompressed[0] = 0x04
        // non-zero coords
        uncompressed[32] = 0x01
        uncompressed[64] = 0x02
        val jwk = SECDSAKey.uncompressedToJwk(uncompressed, "kid-1")
        assertEquals("EC", jwk.kty)
        assertEquals("P-256", jwk.crv)
        assertTrue(jwk.x.isNotEmpty())
        assertTrue(jwk.y.isNotEmpty())
    }

    @Test
    fun derToJoseFixed64() {
        // r=1, s=2 minimal DER
        val der = byteArrayOf(
            0x30, 0x06,
            0x02, 0x01, 0x01,
            0x02, 0x01, 0x02,
        )
        val jose = SECDSAKey.derToJoseEs256(der)
        assertEquals(64, jose.size)
        assertEquals(1, jose[31].toInt())
        assertEquals(2, jose[63].toInt())
    }

    @Test
    fun keyManagerRegistersSecdsaBackend() {
        WaltCryptoSecdsa.init()
        assertTrue(id.walt.crypto.keys.KeyManager.types.containsKey("secdsa"))
    }
}
