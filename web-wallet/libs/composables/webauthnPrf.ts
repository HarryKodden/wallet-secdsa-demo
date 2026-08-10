/**
 * WebAuthn PRF utilities for browser-side key derivation and local secret encryption.
 *
 * PRF (Pseudo-Random Function) extension — the authenticator computes
 *   HMAC-SHA-256(credPrivateKey, evalFirst) inside the secure element and returns
 *   32 bytes. These bytes never leave the authenticator in readable form and are
 *   only accessible during an authenticated WebAuthn get() call.
 *
 * We use those bytes as HKDF input to produce an AES-GCM-256 key that stays in
 * memory only (Pinia). Nothing PRF-derived is ever sent to the server.
 */

const DB_NAME = "wallet-local-v1";
const SALT_STORE = "appSalts";
const INFO_AES  = new TextEncoder().encode("wallet-local-enc-v1");

// ---------------------------------------------------------------------------
// IndexedDB helper (minimal — no deps)
// ---------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(SALT_STORE)) {
                db.createObjectStore(SALT_STORE);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbGet(store: string, key: string): Promise<unknown> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readonly");
        const req = tx.objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function idbPut(store: string, key: string, value: unknown): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, "readwrite");
        const req = tx.objectStore(store).put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// ---------------------------------------------------------------------------
// Base64url helpers (no external deps)
// ---------------------------------------------------------------------------

export function b64uDecode(b64u: string): Uint8Array {
    const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function b64uEncode(bytes: Uint8Array): string {
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// ---------------------------------------------------------------------------
// APP_SALT — per-account random domain separator (not secret, stored in IndexedDB)
// ---------------------------------------------------------------------------

/**
 * Returns the stored APP_SALT for this account, or creates and persists a new one.
 * The salt is NOT secret — it's a stable domain-separation value so PRF output
 * is scoped to this app. Losing it means existing encrypted blobs are unreadable;
 * re-fetching them from the server recovers state.
 */
export async function getOrCreateAppSalt(accountId: string): Promise<Uint8Array> {
    const key = `salt:${accountId}`;
    const stored = await idbGet(SALT_STORE, key) as string | undefined;
    if (stored) {
        return b64uDecode(stored);
    }
    const salt = crypto.getRandomValues(new Uint8Array(32));
    await idbPut(SALT_STORE, key, b64uEncode(salt));
    return salt;
}

// ---------------------------------------------------------------------------
// PRF key derivation
// ---------------------------------------------------------------------------

/**
 * Derives an AES-GCM-256 key from the raw PRF output bytes using HKDF.
 * @param prfBytes  32-byte raw output from the authenticator's PRF extension.
 * @param appSalt   Per-account domain-separation salt (the eval.first input).
 */
export async function derivePrfKey(
    prfBytes: ArrayBuffer | Uint8Array,
    appSalt: Uint8Array,
): Promise<CryptoKey> {
    const raw = await crypto.subtle.importKey("raw", prfBytes, "HKDF", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
        {name: "HKDF", hash: "SHA-256", salt: appSalt, info: INFO_AES},
        raw,
        {name: "AES-GCM", length: 256},
        false,
        ["encrypt", "decrypt"],
    );
}

// ---------------------------------------------------------------------------
// Encrypt / decrypt helpers (used by localSecretsStore)
// ---------------------------------------------------------------------------

export type EncryptedBlob = {
    /** Base64url-encoded 12-byte IV. */
    iv: string;
    /** Base64url-encoded AES-GCM ciphertext. */
    ct: string;
};

export async function encryptBlob(key: CryptoKey, plaintext: Uint8Array): Promise<EncryptedBlob> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({name: "AES-GCM", iv}, key, plaintext);
    return {iv: b64uEncode(iv), ct: b64uEncode(new Uint8Array(ct))};
}

export async function decryptBlob(key: CryptoKey, blob: EncryptedBlob): Promise<Uint8Array> {
    const iv = b64uDecode(blob.iv);
    const ct = b64uDecode(blob.ct);
    const plain = await crypto.subtle.decrypt({name: "AES-GCM", iv}, key, ct);
    return new Uint8Array(plain);
}

// ---------------------------------------------------------------------------
// PIN-specific helpers (UTF-8 string ↔ EncryptedBlob)
// ---------------------------------------------------------------------------

/** Encrypts a plaintext PIN string using the PRF-derived AES-GCM key. */
export async function encryptPin(key: CryptoKey, pin: string): Promise<EncryptedBlob> {
    return encryptBlob(key, new TextEncoder().encode(pin));
}

/** Decrypts a stored PIN blob back to a plaintext string. */
export async function decryptPin(key: CryptoKey, blob: EncryptedBlob): Promise<string> {
    return new TextDecoder().decode(await decryptBlob(key, blob));
}
