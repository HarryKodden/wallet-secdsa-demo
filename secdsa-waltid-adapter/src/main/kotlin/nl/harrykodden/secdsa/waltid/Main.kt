package nl.harrykodden.secdsa.waltid

import kotlinx.coroutines.runBlocking
import nl.harrykodden.secdsa.waltid.client.WscaClient
import nl.harrykodden.secdsa.waltid.config.WscaConfig
import nl.harrykodden.secdsa.waltid.key.SECDSAKey
import nl.harrykodden.secdsa.waltid.key.WaltCryptoSecdsa

/**
 * Tiny CLI for Phase 1 demos:
 *   WSCA_BASE_URL=http://127.0.0.1:8080 WSCA_PIN=424242 \
 *     ./gradlew run --args='424242'
 */
fun main(args: Array<String>) = runBlocking {
    WaltCryptoSecdsa.init()

    val config = WscaConfig()
    val client = WscaClient(config)
    val pin = args.getOrNull(0) ?: config.pinEnvFallback
        ?: error("Pass PIN as argv[0] or set WSCA_PIN")

    println("SECDSA ← walt.id adapter (educational)")
    println("WSCA ${config.normalizedBaseUrl()} account=${config.accountId}")
    if (!client.health()) {
        System.err.println("Trust layer not reachable — start HarryKodden/SECDSA lab/wsca first.")
        kotlin.system.exitProcess(1)
    }
    client.unlock(pin)
    val key = SECDSAKey.generate(client, config)
    println("keyId=${key.getKeyId()}")
    println("jwk=${key.exportJWK()}")
    val msg = "hello-from-adapter".toByteArray()
    val sig = key.signRaw(msg) as ByteArray
    println("signRaw ok bytes=${sig.size} verify=${key.verifyRawLocal(sig, msg)}")
    val jws = key.signJws("""{"sub":"demo"}""".toByteArray())
    println("signJws=${jws.take(80)}…")
}
