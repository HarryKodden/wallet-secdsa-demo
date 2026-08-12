package id.walt.wallet2.persistence

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.v1.jdbc.Database
import org.jetbrains.exposed.v1.jdbc.SchemaUtils
import org.jetbrains.exposed.v1.jdbc.transactions.transaction
import java.io.File

private val log = KotlinLogging.logger {}

private fun ensureSqliteParentDir(jdbcUrl: String) {
    val prefix = "jdbc:sqlite:"
    if (!jdbcUrl.startsWith(prefix)) return

    val path = jdbcUrl.removePrefix(prefix).substringBefore('?')
    if (path.isBlank() || path.startsWith(":")) return // e.g. ":memory:"

    val parent = File(path).absoluteFile.parentFile ?: return
    if (!parent.exists() && parent.mkdirs()) {
        log.info { "Created SQLite data directory: $parent" }
    }
}

/**
 * HOCON configuration for the wallet2 persistence layer.
 */
@Serializable
data class Wallet2PersistenceConfig(
    val jdbcUrl: String = "jdbc:sqlite:wallet2.db",
    val driverClassName: String = "org.sqlite.JDBC",
    val username: String = "",
    val password: String = "",
    val maximumPoolSize: Int = 5,
    val minimumIdle: Int = 1,
)

/**
 * Initialises the Exposed [Database] connection pool and creates any missing tables.
 *
 * Also applies additive migrations for columns introduced by this demo overlay
 * (e.g. `display_name`) so existing Postgres volumes pick them up even when an
 * older [Wallet2Tables] was used for the original SchemaUtils pass.
 */
fun initWallet2Database(
    config: Wallet2PersistenceConfig = Wallet2PersistenceConfig()
): Database {
    log.info { "Initialising wallet2 database: ${config.jdbcUrl}" }

    ensureSqliteParentDir(config.jdbcUrl)

    val hikari = HikariConfig().apply {
        jdbcUrl = config.jdbcUrl
        driverClassName = config.driverClassName
        if (config.username.isNotBlank()) username = config.username
        if (config.password.isNotBlank()) password = config.password
        maximumPoolSize = config.maximumPoolSize
        minimumIdle = config.minimumIdle
        isAutoCommit = false
        transactionIsolation = "TRANSACTION_SERIALIZABLE"
        validate()
    }

    val db = Database.connect(HikariDataSource(hikari))

    transaction(db) {
        SchemaUtils.createMissingTablesAndColumns(*Wallet2Tables.ALL)
        ensureWalletDisplayNameColumn()
        log.info { "wallet2 schema ready" }
    }

    return db
}

/** Additive migration for wallet friendly names (safe on Postgres + SQLite). */
private fun ensureWalletDisplayNameColumn() {
    val alreadyPresent = Wallet2Tables.Wallets.columns.any { it.name == "display_name" }
    // SchemaUtils may have added it via createMissingTablesAndColumns when our
    // overlay Wallet2Tables is on the classpath; still try ALTER for older volumes.
    try {
        val jdbc = org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager.current().db.url
        if (jdbc.contains("postgresql", ignoreCase = true)) {
            execQuiet("ALTER TABLE wallet2_wallets ADD COLUMN IF NOT EXISTS display_name VARCHAR(128)")
        } else {
            // SQLite: ADD COLUMN fails if it already exists — ignore.
            execQuiet("ALTER TABLE wallet2_wallets ADD COLUMN display_name VARCHAR(128)")
        }
        log.info { "Ensured wallet2_wallets.display_name column (overlay alreadyPresent=$alreadyPresent)" }
    } catch (e: Exception) {
        log.warn(e) { "Could not ensure display_name column" }
    }
}

private fun execQuiet(sql: String) {
    org.jetbrains.exposed.v1.jdbc.transactions.TransactionManager.current().exec(sql)
}
