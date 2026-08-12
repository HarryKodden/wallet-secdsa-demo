package id.walt.wallet2.server.events

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import kotlin.time.Clock
import kotlin.time.Instant

/**
 * Auditable event log for wallet-api2.
 *
 * Default backend is in-process (lost on restart). When `wallet2-persistence` is enabled,
 * [wallet-api2 Main] swaps in an Exposed/SQL backend so events survive refresh/restarts.
 */
object Wallet2EventLog {

    @Volatile
    var backend: Wallet2EventLogBackend = InMemoryWallet2EventLogBackend()

    fun append(
        walletId: String,
        event: String,
        action: String,
        originator: String = "wallet",
        tenant: String = "local",
        data: JsonObject = buildJsonObject {},
        credentialId: String? = null,
        note: String? = null,
    ): Wallet2Event = backend.append(
        walletId = walletId,
        event = event,
        action = action,
        originator = originator,
        tenant = tenant,
        data = data,
        credentialId = credentialId,
        note = note,
    )

    fun list(
        walletId: String,
        limit: Int = 10,
        startingAfter: String? = null,
    ): Wallet2EventLogPage = backend.list(walletId, limit, startingAfter)

    fun clear(walletId: String) = backend.clear(walletId)
}

interface Wallet2EventLogBackend {
    fun append(
        walletId: String,
        event: String,
        action: String,
        originator: String = "wallet",
        tenant: String = "local",
        data: JsonObject = buildJsonObject {},
        credentialId: String? = null,
        note: String? = null,
    ): Wallet2Event

    fun list(
        walletId: String,
        limit: Int = 10,
        startingAfter: String? = null,
    ): Wallet2EventLogPage

    fun clear(walletId: String)
}

class InMemoryWallet2EventLogBackend(
    private val maxPerWallet: Int = 500,
) : Wallet2EventLogBackend {

    private val seq = AtomicInteger(0)
    private val byWallet = ConcurrentHashMap<String, MutableList<Wallet2Event>>()

    override fun append(
        walletId: String,
        event: String,
        action: String,
        originator: String,
        tenant: String,
        data: JsonObject,
        credentialId: String?,
        note: String?,
    ): Wallet2Event {
        val entry = Wallet2Event(
            id = seq.incrementAndGet(),
            event = event,
            action = action,
            timestamp = Clock.System.now(),
            tenant = tenant,
            originator = originator,
            wallet = walletId,
            credentialId = credentialId,
            data = data,
            note = note,
        )
        val list = byWallet.getOrPut(walletId) { mutableListOf() }
        synchronized(list) {
            list.add(0, entry)
            while (list.size > maxPerWallet) list.removeAt(list.lastIndex)
        }
        return entry
    }

    override fun list(
        walletId: String,
        limit: Int,
        startingAfter: String?,
    ): Wallet2EventLogPage {
        val all = byWallet[walletId]?.toList() ?: emptyList()
        val startIndex = startingAfter
            ?.takeIf { it != "-1" && it.isNotBlank() }
            ?.toIntOrNull()
            ?.coerceAtLeast(0)
            ?: 0
        val pageSize = limit.coerceIn(1, 100)
        val slice = all.drop(startIndex).take(pageSize)
        val next = startIndex + slice.size
        return Wallet2EventLogPage(
            items = slice,
            count = all.size,
            currentStartingAfter = if (startIndex > 0) startIndex.toString() else null,
            nextStartingAfter = if (next < all.size) next.toString() else null,
        )
    }

    override fun clear(walletId: String) {
        byWallet.remove(walletId)
    }
}

@Serializable
data class Wallet2Event(
    val id: Int,
    val event: String,
    val action: String,
    val timestamp: Instant,
    val tenant: String,
    val originator: String? = null,
    val wallet: String? = null,
    val credentialId: String? = null,
    val data: JsonObject = buildJsonObject {},
    val note: String? = null,
)

@Serializable
data class Wallet2EventLogPage(
    val items: List<Wallet2Event>,
    val count: Int,
    val currentStartingAfter: String? = null,
    val nextStartingAfter: String? = null,
)

fun eventData(vararg pairs: Pair<String, String>) = buildJsonObject {
    pairs.forEach { (k, v) -> put(k, v) }
}
