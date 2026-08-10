/**
 * localSecretsStore — browser-side persistent key/value store backed by IndexedDB.
 *
 * When a PRF-derived AES-GCM key is available (from useSecurityStore), values are
 * encrypted before writing and decrypted on read. When no key is available (e.g.
 * lab email login, or authenticator without PRF), values are stored as plain JSON.
 *
 * Values stored here are CACHE/UX data (WSCA status, device fingerprints). They
 * are always re-fetchable from the server; losing them is not destructive.
 *
 * Nothing in this store should ever be sent to the server.
 */

import {encryptBlob, decryptBlob, b64uEncode} from "./webauthnPrf";
import type {EncryptedBlob} from "./webauthnPrf";
import {useSecurityStore} from "@waltid-web-wallet/stores/security";

const DB_NAME = "wallet-local-v1";
const SECRET_STORE = "secrets";

// ---------------------------------------------------------------------------
// IndexedDB primitives (same DB opened by webauthnPrf for appSalts)
// ---------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains("appSalts")) {
                db.createObjectStore("appSalts");
            }
            if (!db.objectStoreNames.contains(SECRET_STORE)) {
                db.createObjectStore(SECRET_STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbGet(key: string): Promise<unknown> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SECRET_STORE, "readonly");
        const req = tx.objectStore(SECRET_STORE).get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
    });
}

async function idbPut(key: string, value: unknown): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SECRET_STORE, "readwrite");
        const req = tx.objectStore(SECRET_STORE).put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function idbDelete(key: string): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(SECRET_STORE, "readwrite");
        const req = tx.objectStore(SECRET_STORE).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// ---------------------------------------------------------------------------
// Record format stored in IndexedDB
// ---------------------------------------------------------------------------

type PlainRecord = {encrypted: false; value: unknown};
type EncryptedRecord = {encrypted: true; blob: EncryptedBlob};
type StoredRecord = PlainRecord | EncryptedRecord;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function storeKey(accountId: string, name: string): string {
    return `${accountId}:${name}`;
}

/**
 * Writes a value to the local secrets store.
 * Encrypts with the PRF key if available; stores plain JSON otherwise.
 */
export async function setSecret(accountId: string, name: string, value: unknown): Promise<void> {
    const securityStore = useSecurityStore();
    const key = securityStore.prfAccountId === accountId ? securityStore.prfKey : null;

    let record: StoredRecord;
    if (key) {
        const plaintext = new TextEncoder().encode(JSON.stringify(value));
        const blob = await encryptBlob(key, plaintext);
        record = {encrypted: true, blob};
    } else {
        record = {encrypted: false, value};
    }

    await idbPut(storeKey(accountId, name), record);
}

/**
 * Reads a value from the local secrets store.
 * Returns null on any error (missing key, decryption failure, DB error).
 */
export async function getSecret<T = unknown>(accountId: string, name: string): Promise<T | null> {
    try {
        const raw = await idbGet(storeKey(accountId, name)) as StoredRecord | null;
        if (!raw) return null;

        if (!raw.encrypted) {
            return (raw as PlainRecord).value as T;
        }

        const securityStore = useSecurityStore();
        const key = securityStore.prfAccountId === accountId ? securityStore.prfKey : null;
        if (!key) {
            // PRF key not in memory — can't decrypt; discard stale encrypted value
            console.warn("[localSecretsStore] PRF key unavailable; discarding encrypted cache for", name);
            return null;
        }

        const plaintext = await decryptBlob(key, (raw as EncryptedRecord).blob);
        return JSON.parse(new TextDecoder().decode(plaintext)) as T;
    } catch (err) {
        console.warn("[localSecretsStore] read error for", name, err);
        return null;
    }
}

/**
 * Removes a single secret.
 */
export async function deleteSecret(accountId: string, name: string): Promise<void> {
    await idbDelete(storeKey(accountId, name));
}

/**
 * Removes all secrets for an account (e.g. on logout or passkey revocation).
 */
export async function clearSecrets(accountId: string): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(SECRET_STORE, "readwrite");
        const store = tx.objectStore(SECRET_STORE);
        const req = store.openCursor();
        req.onsuccess = () => {
            const cursor = req.result;
            if (!cursor) { resolve(); return; }
            if ((cursor.key as string).startsWith(`${accountId}:`)) {
                cursor.delete();
            }
            cursor.continue();
        };
        req.onerror = () => reject(req.error);
    });
}

/**
 * Re-encrypts all plain records for an account with the current PRF key.
 * Call this after a new passkey is registered to retroactively protect existing cache.
 */
export async function reEncryptSecrets(accountId: string): Promise<void> {
    const securityStore = useSecurityStore();
    const key = securityStore.prfAccountId === accountId ? securityStore.prfKey : null;
    if (!key) return;

    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(SECRET_STORE, "readwrite");
        const store = tx.objectStore(SECRET_STORE);
        const req = store.openCursor();
        req.onsuccess = async () => {
            const cursor = req.result;
            if (!cursor) { resolve(); return; }
            if ((cursor.key as string).startsWith(`${accountId}:`)) {
                const record = cursor.value as StoredRecord;
                if (!record.encrypted) {
                    try {
                        const plaintext = new TextEncoder().encode(JSON.stringify((record as PlainRecord).value));
                        const blob = await encryptBlob(key, plaintext);
                        cursor.update({encrypted: true, blob} satisfies EncryptedRecord);
                    } catch { /* skip on error */ }
                }
            }
            cursor.continue();
        };
        req.onerror = () => reject(req.error);
    });
}

// ---------------------------------------------------------------------------
// Convenience: WSCA status cache (replaces in-memory fetch each load)
// ---------------------------------------------------------------------------

const WSCA_STATUS_KEY = "wsca_status";

export async function getCachedWscaStatus(accountId: string, walletId: string) {
    return getSecret<{status: unknown; cachedAt: number}>(accountId, `${WSCA_STATUS_KEY}:${walletId}`);
}

export async function setCachedWscaStatus(accountId: string, walletId: string, status: unknown): Promise<void> {
    await setSecret(accountId, `${WSCA_STATUS_KEY}:${walletId}`, {status, cachedAt: Date.now()});
}
