package id.walt.wallet2.auth

import id.walt.commons.config.ConfigManager
import id.walt.commons.web.modules.AuthenticationServiceModule
import id.walt.crypto.keys.KeyManager
import id.walt.wallet2.server.WalletResolver
import kotlin.time.Duration
import kotlin.time.Duration.Companion.hours
import id.walt.ktorauthnz.AuthContext
import id.walt.ktorauthnz.KtorAuthnzManager
import id.walt.ktorauthnz.accounts.Account
import id.walt.ktorauthnz.accounts.EditableAccountStore
import id.walt.ktorauthnz.accounts.identifiers.methods.AccountIdentifier
import id.walt.ktorauthnz.accounts.identifiers.methods.EmailIdentifier
import id.walt.ktorauthnz.auth.getAuthenticatedAccount
import id.walt.ktorauthnz.auth.getEffectiveRequestAuthToken
import id.walt.ktorauthnz.auth.ktorAuthnz
import id.walt.ktorauthnz.methods.AuthenticationMethod
import id.walt.ktorauthnz.methods.EmailPass
import id.walt.ktorauthnz.methods.registerAuthenticationMethod
import id.walt.ktorauthnz.methods.storeddata.AuthMethodStoredData
import id.walt.ktorauthnz.methods.storeddata.EmailPassStoredData
import id.walt.ktorauthnz.tokens.jwttoken.JwtTokenHandler
import id.walt.wallet2.OSSWallet2AuthConfig
import io.github.oshai.kotlinlogging.KotlinLogging
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.auth.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.util.concurrent.ConcurrentHashMap
import kotlin.io.path.exists
import kotlin.io.path.readText
import kotlin.uuid.Uuid

private val authLog = KotlinLogging.logger {}

// ---------------------------------------------------------------------------
// Account store (in-memory + optional file snapshot for demo restarts)
// ---------------------------------------------------------------------------

@Serializable
private data class PersistedAccount(val id: String, val name: String? = null)

@Serializable
private data class PersistedEmailPass(val passwordHash: String)

/**
 * Snapshot of email/password accounts. Wallet ownership stays in Postgres
 * ([id.walt.wallet2.stores.WalletStore]); this file only restores login identities
 * so the same accountId can reclaim existing wallets after wallet-api2 restart.
 */
@Serializable
private data class AccountStoreSnapshot(
    val accounts: List<PersistedAccount> = emptyList(),
    /** email → accountId */
    val emailToAccountId: Map<String, String> = emptyMap(),
    /** email → email-pass stored data */
    val emailPassByEmail: Map<String, PersistedEmailPass> = emptyMap(),
)

/**
 * [EditableAccountStore] for the OSS wallet service.
 * Manages user accounts and authentication credentials only.
 * Wallet ownership (account-to-wallet mapping) is managed by the [id.walt.wallet2.stores.WalletStore].
 *
 * Optionally persists email/password accounts to [WALLET2_ACCOUNT_STORE_PATH]
 * (default `/data/wallet2-accounts.json`) so demos survive container restarts.
 */
object OSSWallet2AccountStore : EditableAccountStore {

    private val accounts = ConcurrentHashMap<String, Account>()
    private val identifierToAccountId = ConcurrentHashMap<AccountIdentifier, String>()
    private val identifierStoredData = ConcurrentHashMap<AccountIdentifier, ConcurrentHashMap<String, AuthMethodStoredData>>()
    private val accountStoredData = ConcurrentHashMap<String, ConcurrentHashMap<String, AuthMethodStoredData>>()

    private val persistJson = Json {
        prettyPrint = true
        ignoreUnknownKeys = true
    }

    private fun storePath(): Path? {
        val raw = System.getenv("WALLET2_ACCOUNT_STORE_PATH")?.trim().orEmpty()
        if (raw.equals("none", ignoreCase = true) || raw.equals("off", ignoreCase = true)) {
            return null
        }
        val path = if (raw.isNotEmpty()) Path.of(raw) else Path.of("/data/wallet2-accounts.json")
        return path
    }

    fun loadFromDisk() {
        val path = storePath() ?: return
        if (!path.exists()) {
            authLog.info { "Account store file not found (will create on register): $path" }
            return
        }
        try {
            val snapshot = persistJson.decodeFromString<AccountStoreSnapshot>(path.readText())
            accounts.clear()
            identifierToAccountId.clear()
            identifierStoredData.clear()
            accountStoredData.clear()
            snapshot.accounts.forEach { accounts[it.id] = Account(id = it.id, name = it.name) }
            snapshot.emailToAccountId.forEach { (email, accountId) ->
                identifierToAccountId[EmailIdentifier(email)] = accountId
            }
            snapshot.emailPassByEmail.forEach { (email, pass) ->
                identifierStoredData.getOrPut(EmailIdentifier(email)) { ConcurrentHashMap() }[EmailPass.id] =
                    EmailPassStoredData(passwordHash = pass.passwordHash)
            }
            authLog.info {
                "Loaded ${accounts.size} account(s) from $path"
            }
        } catch (e: Exception) {
            authLog.error(e) { "Failed to load account store from $path" }
        }
    }

    private fun persistToDisk() {
        val path = storePath() ?: return
        try {
            val emailEntries = identifierToAccountId.entries
                .mapNotNull { (identifier, accountId) ->
                    val email = (identifier as? EmailIdentifier)?.email ?: return@mapNotNull null
                    email to accountId
                }
                .toMap()
            val emailPass = emailEntries.keys.mapNotNull { email ->
                val data = identifierStoredData[EmailIdentifier(email)]?.get(EmailPass.id) as? EmailPassStoredData
                val hash = data?.passwordHash ?: return@mapNotNull null
                email to PersistedEmailPass(passwordHash = hash)
            }.toMap()
            val snapshot = AccountStoreSnapshot(
                accounts = accounts.values.map { PersistedAccount(it.id, it.name) },
                emailToAccountId = emailEntries,
                emailPassByEmail = emailPass,
            )
            val parent = path.parent
            if (parent != null) {
                Files.createDirectories(parent)
            }
            val tmp = path.resolveSibling("${path.fileName}.tmp")
            Files.writeString(tmp, persistJson.encodeToString(snapshot))
            try {
                Files.move(tmp, path, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
            } catch (_: Exception) {
                Files.move(tmp, path, StandardCopyOption.REPLACE_EXISTING)
            }
        } catch (e: Exception) {
            authLog.error(e) { "Failed to persist account store to $path" }
        }
    }

    fun createAccount(email: String): Account {
        val account = Account(id = Uuid.random().toString(), name = email)
        accounts[account.id] = account
        persistToDisk()
        return account
    }

    override suspend fun addAccountIdentifierToAccount(accountId: String, newAccountIdentifier: AccountIdentifier) {
        identifierToAccountId[newAccountIdentifier] = accountId
        persistToDisk()
    }

    override suspend fun removeAccountIdentifierFromAccount(accountIdentifier: AccountIdentifier) {
        identifierToAccountId.remove(accountIdentifier)
        persistToDisk()
    }

    override suspend fun addAccountIdentifierStoredData(accountIdentifier: AccountIdentifier, method: String, data: AuthMethodStoredData) =
        updateAccountIdentifierStoredData(accountIdentifier, method, data)

    override suspend fun addAccountStoredData(accountId: String, method: String, data: AuthMethodStoredData) =
        updateAccountStoredData(accountId, method, data)

    override suspend fun updateAccountIdentifierStoredData(
        accountIdentifier: AccountIdentifier,
        method: String,
        data: AuthMethodStoredData
    ) {
        identifierStoredData.getOrPut(accountIdentifier) { ConcurrentHashMap() }[method] = data.transformSavable()
        persistToDisk()
    }

    override suspend fun updateAccountStoredData(accountId: String, method: String, data: AuthMethodStoredData) {
        accountStoredData.getOrPut(accountId) { ConcurrentHashMap() }[method] = data.transformSavable()
        persistToDisk()
    }

    override suspend fun deleteAccountIdentifierStoredData(accountIdentifier: AccountIdentifier, method: String) {
        identifierStoredData[accountIdentifier]?.remove(method)
        persistToDisk()
    }

    override suspend fun deleteAccountStoredData(accountId: String, method: String) {
        accountStoredData[accountId]?.remove(method)
        persistToDisk()
    }

    override suspend fun lookupStoredDataForAccount(accountId: String, method: AuthenticationMethod): AuthMethodStoredData? =
        accountStoredData[accountId]?.get(method.id)

    override suspend fun lookupStoredDataForAccountIdentifier(
        identifier: AccountIdentifier,
        method: AuthenticationMethod
    ): AuthMethodStoredData? =
        identifierStoredData[identifier]?.get(method.id)

    override suspend fun hasStoredDataFor(identifier: AccountIdentifier, method: AuthenticationMethod): Boolean =
        identifierStoredData[identifier]?.containsKey(method.id) == true

    fun getEmailForAccount(accountId: String): String? =
        identifierToAccountId.entries
            .firstOrNull { it.value == accountId && it.key is EmailIdentifier }
            ?.key
            ?.let { (it as? EmailIdentifier)?.email }

    override suspend fun lookupAccountUuid(identifier: AccountIdentifier): String? =
        identifierToAccountId[identifier]
}

// ---------------------------------------------------------------------------
// Auth route models
// ---------------------------------------------------------------------------

@Serializable
data class RegisterRequest(val email: String, val password: String)
@Serializable
data class AccountInfoResponse(
    val accountId: String,
    val email: String,
    val walletIds: List<String>,
)

// ---------------------------------------------------------------------------
// Auth module wiring
// ---------------------------------------------------------------------------

/**
 * Configures [KtorAuthnzManager] for JWT-based session tokens and hooks into
 * [AuthenticationServiceModule] so the Ktor Authentication plugin is installed
 * exactly once by the WebService wrapper.
 *
 * Reads [OSSWallet2AuthConfig] from the config manager:
 * - [OSSWallet2AuthConfig.signingKey]: waltid-crypto key used to sign and verify JWT
 *   session tokens. Must be identical on every replica (HA-safe).
 * - [OSSWallet2AuthConfig.tokenExpiry]: JWT `exp` lifetime as a [Duration].
 *
 * Returns the loaded [OSSWallet2AuthConfig] so the caller can pass
 * [OSSWallet2AuthConfig.tokenExpiry] to [registerWallet2AuthRoutes].
 *
 * Called from Main.kt when the auth optional feature is enabled.
 */
suspend fun Application.configureWallet2Auth(): OSSWallet2AuthConfig {
    val config = ConfigManager.getConfig<OSSWallet2AuthConfig>()

    // Resolve serialized key JSON from auth.conf at runtime (Hoplite-safe).
    val signingKey = KeyManager.resolveSerializedKeyBlocking(config.signingKey.toString())

    KtorAuthnzManager.accountStore = OSSWallet2AccountStore
    OSSWallet2AccountStore.loadFromDisk()
    KtorAuthnzManager.tokenHandler = JwtTokenHandler().apply {
        this.signingKey = signingKey
        verificationKey = signingKey
    }

    AuthenticationServiceModule.AuthenticationServiceConfig.customAuthentication = {
        // Keep authservice feature behavior consistent if used elsewhere.
        ktorAuthnz("ktor-authnz") { }
    }

    authLog.info { "Wallet2 auth configured: JWT tokens (keyType=${signingKey.keyType}, expiry=${config.tokenExpiry})" }
    return config
}

/**
 * Registers /auth/[*] routes.
 * Should be called inside the main routing block when auth is enabled.
 *
 * @param tokenExpiry JWT token lifetime embedded into the [AuthFlow].
 *   Defaults to 24 hours. Pass the value from [configureWallet2Auth] to keep it in sync.
 * @param walletResolver The resolver used for wallet ownership lookups (account/wallets routes).
 *   Must be the same resolver that the wallet routes use so both read from the same store.
 */
fun Route.registerWallet2AuthRoutes(tokenExpiry: Duration = 24.hours, walletResolver: WalletResolver) {
    route("/auth") {

        post("/register") {
            val req = call.receive<RegisterRequest>()
            val existing = OSSWallet2AccountStore.lookupAccountUuid(EmailIdentifier(req.email))
            if (existing != null) {
                return@post call.respond(HttpStatusCode.Conflict, "Account '${req.email}' already exists")
            }
            val account = OSSWallet2AccountStore.createAccount(req.email)
            val identifier = EmailIdentifier(req.email)
            OSSWallet2AccountStore.addAccountIdentifierToAccount(account.id, identifier)
            OSSWallet2AccountStore.addAccountIdentifierStoredData(
                identifier, EmailPass.id,
                EmailPassStoredData(req.password)
            )
            authLog.info { "Registered account ${account.id} for ${req.email}" }
            call.respond(HttpStatusCode.Created, mapOf("accountId" to account.id))
        }

        // expiration is an ISO-8601 duration string parsed by AuthFlow.parsedDuration.
        val emailPassFlow = id.walt.ktorauthnz.flows.AuthFlow(
            method = EmailPass.id,
            success = true,
            expiration = tokenExpiry.toIsoString()
        )
        registerAuthenticationMethod(EmailPass, authContext = {
            AuthContext(
                implicitSessionGeneration = true,
                initialFlow = emailPassFlow
            )
        })

        post("/logout") {
            val token = call.getEffectiveRequestAuthToken()
            if (token != null) {
                KtorAuthnzManager.tokenHandler.dropToken(token)
            }
            call.respond(HttpStatusCode.OK, mapOf("status" to "logged out"))
        }

        authenticate("ktor-authnz") {
            get("/account") {
                val accountId = call.getAuthenticatedAccount()
                val walletIds = walletResolver.getWalletIdsForAccount(accountId) ?: emptyList()
                call.respond(
                    AccountInfoResponse(
                        accountId = accountId,
                        email = OSSWallet2AccountStore.getEmailForAccount(accountId) ?: "",
                        walletIds = walletIds,
                    )
                )
            }

            get("/account/wallets") {
                val accountId = call.getAuthenticatedAccount()
                call.respond(walletResolver.getWalletIdsForAccount(accountId) ?: emptyList<String>())
            }

            post("/account/wallets/{walletId}") {
                val accountId = call.getAuthenticatedAccount()
                val walletId = call.parameters["walletId"]!!
                walletResolver.linkWalletToAccount(accountId, walletId)
                call.respond(HttpStatusCode.OK, mapOf("status" to "linked"))
            }
        }
    }
}
