import {readFileSync, writeFileSync, mkdirSync, existsSync} from "node:fs";
import {join} from "node:path";

/**
 * Server-side store for PRF-encrypted WSCA PIN blobs.
 *
 * The server stores ONLY the AES-GCM ciphertext — the decryption key is the
 * PRF output from the user's passkey and never reaches the server.  Even if
 * the file is compromised the PINs remain protected.
 *
 * Shape on disk: { "pins": { "<accountId>": { "iv": "…", "ct": "…" } } }
 */

export type EncryptedPinBlob = {
    /** Base64url-encoded 12-byte AES-GCM IV. */
    iv: string;
    /** Base64url-encoded AES-GCM ciphertext of the UTF-8 encoded PIN. */
    ct: string;
};

type PinStoreFile = {pins: Record<string, EncryptedPinBlob>};

const DATA_DIR = process.env.WEBAUTHN_DATA_DIR || "/data";
const PINS_FILE = join(DATA_DIR, "wsca-pins.json");

function load(): PinStoreFile {
    try {
        if (!existsSync(PINS_FILE)) return {pins: {}};
        const raw = readFileSync(PINS_FILE, "utf-8");
        const parsed = JSON.parse(raw) as PinStoreFile;
        return parsed && typeof parsed.pins === "object" ? parsed : {pins: {}};
    } catch (e) {
        console.warn("[wscaPinStore] Could not read pins file:", e);
        return {pins: {}};
    }
}

function save(store: PinStoreFile): void {
    try {
        if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, {recursive: true});
        writeFileSync(PINS_FILE, JSON.stringify(store, null, 2), "utf-8");
    } catch (e) {
        console.warn("[wscaPinStore] Could not write pins file:", e);
    }
}

export function getEncryptedPin(accountId: string): EncryptedPinBlob | null {
    return load().pins[accountId] ?? null;
}

export function setEncryptedPin(accountId: string, blob: EncryptedPinBlob): void {
    const store = load();
    store.pins[accountId] = blob;
    save(store);
}
