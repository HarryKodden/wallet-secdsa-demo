package id.walt.wallet2.solecontrol

import java.security.SecureRandom
import java.time.Instant
import java.util.Base64
import java.util.concurrent.ConcurrentHashMap

enum class SignGrantPurpose {
    issuance,
    presentation,
    keygen,
    ;

    companion object {
        fun parse(raw: String): SignGrantPurpose =
            entries.find { it.name.equals(raw.trim(), ignoreCase = true) }
                ?: error("purpose must be one of: ${entries.joinToString { it.name }}")
    }
}

data class SignGrantBinding(
    val offerId: String? = null,
    val requestHash: String? = null,
    val clientId: String? = null,
)

data class SignGrant(
    val id: String,
    val walletId: String,
    val accountId: String,
    val keyId: String,
    val purpose: SignGrantPurpose,
    val binding: SignGrantBinding,
    val expiresAt: Instant,
)

/**
 * Process-memory SignGrant store (lab). Survives SPA navigations; cleared on
 * wallet-api2 restart. Not a substitute for durable WP session storage.
 */
object SignGrantStore {
    private val grants = ConcurrentHashMap<String, SignGrant>()
    private val random = SecureRandom()

    fun mint(
        walletId: String,
        accountId: String,
        keyId: String,
        purpose: SignGrantPurpose,
        binding: SignGrantBinding = SignGrantBinding(),
        ttlSeconds: Long = SoleControlSigning.DEFAULT_GRANT_TTL_SECONDS,
    ): SignGrant {
        require(walletId.isNotBlank()) { "walletId required" }
        require(accountId.isNotBlank()) { "accountId required" }
        require(keyId.isNotBlank()) { "keyId required" }
        purgeExpired()
        val id = newId()
        val grant = SignGrant(
            id = id,
            walletId = walletId,
            accountId = accountId,
            keyId = keyId,
            purpose = purpose,
            binding = binding,
            expiresAt = Instant.now().plusSeconds(ttlSeconds.coerceIn(30L, 600L)),
        )
        grants[id] = grant
        return grant
    }

    /**
     * Validate and consume a grant (single-use). Returns the grant on success.
     */
    fun consume(
        signGrant: String,
        walletId: String,
        keyId: String,
        purpose: SignGrantPurpose,
    ): SignGrant {
        purgeExpired()
        val grant = grants.remove(signGrant.trim())
            ?: error("sign_grant_invalid_or_expired")
        require(grant.walletId == walletId) { "sign_grant_wallet_mismatch" }
        require(grant.keyId == keyId) { "sign_grant_key_mismatch" }
        require(grant.purpose == purpose) { "sign_grant_purpose_mismatch" }
        require(grant.expiresAt.isAfter(Instant.now())) { "sign_grant_invalid_or_expired" }
        return grant
    }

    fun peekValid(signGrant: String?, walletId: String): SignGrant? {
        if (signGrant.isNullOrBlank()) return null
        purgeExpired()
        val grant = grants[signGrant.trim()] ?: return null
        if (grant.walletId != walletId) return null
        if (!grant.expiresAt.isAfter(Instant.now())) {
            grants.remove(grant.id)
            return null
        }
        return grant
    }

    fun hasActiveGrant(walletId: String, accountId: String): Boolean {
        purgeExpired()
        return grants.values.any {
            it.walletId == walletId && it.accountId == accountId && it.expiresAt.isAfter(Instant.now())
        }
    }

    fun clearAll() {
        grants.clear()
    }

    private fun purgeExpired() {
        val now = Instant.now()
        grants.entries.removeIf { !it.value.expiresAt.isAfter(now) }
    }

    private fun newId(): String {
        val bytes = ByteArray(32)
        random.nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }
}
