package nl.harrykodden.secdsa.waltid.key

import id.walt.crypto.keys.KeyGenerationRequest
import id.walt.crypto.keys.KeyManager
import id.walt.crypto.keys.KeySerialization

/**
 * Startup hook mirroring walt.id `WaltCryptoAws` / `WaltCryptoOci` / `WaltCryptoAzure`.
 *
 * Call from a custom Wallet API `main` (or any process that hosts `KeyManager`):
 *
 * ```kotlin
 * WaltCryptoSecdsa.init()
 * ```
 *
 * After this, Wallet API accepts `backend: "secdsa"` on `/keys/generate`.
 * See docs/WALTID_WALLET_API.md.
 */
object WaltCryptoSecdsa {
    @Volatile
    private var initialized = false

    fun init() {
        if (initialized) return
        synchronized(this) {
            if (initialized) return
            KeyManager.register<SECDSAKey>("secdsa") { generateRequest: KeyGenerationRequest ->
                SECDSAKey.generate(generateRequest)
            }
            KeySerialization.registerExternalKeyType(SECDSAKey::class)
            initialized = true
        }
    }
}
