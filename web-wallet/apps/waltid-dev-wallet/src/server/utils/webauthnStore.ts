import {randomBytes} from "node:crypto";
import {readFileSync, writeFileSync, mkdirSync, existsSync} from "node:fs";
import {join} from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StoredCredential = {
    credentialId: string;
    accountId: string;
    email: string;
    publicKey: string;
    counter: number;
    prfCapable: boolean;
    registeredAt: number;
    label: string;
    aaguid: string;
};

type ChallengeEntry = {
    challenge: string;
    accountId: string;
    expiresAt: number;
};

// ---------------------------------------------------------------------------
// File persistence
// ---------------------------------------------------------------------------

const DATA_DIR = process.env.WEBAUTHN_DATA_DIR || "/data";
const CRED_FILE = join(DATA_DIR, "webauthn-credentials.json");

type PersistedStore = {
    credentials: StoredCredential[];
};

function loadFromDisk(): StoredCredential[] {
    try {
        if (!existsSync(CRED_FILE)) return [];
        const raw = readFileSync(CRED_FILE, "utf-8");
        const parsed = JSON.parse(raw) as PersistedStore;
        return Array.isArray(parsed.credentials) ? parsed.credentials : [];
    } catch (err) {
        console.warn("[webauthnStore] Could not read credentials file:", err);
        return [];
    }
}

function saveToDisk(credentials: StoredCredential[]): void {
    try {
        if (!existsSync(DATA_DIR)) {
            mkdirSync(DATA_DIR, {recursive: true});
        }
        const data: PersistedStore = {credentials};
        writeFileSync(CRED_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
        console.warn("[webauthnStore] Could not write credentials file:", err);
    }
}

// ---------------------------------------------------------------------------
// In-memory indexes (rebuilt from disk on startup)
// ---------------------------------------------------------------------------

const CHALLENGE_TTL_MS = 3 * 60 * 1000;
const challengesByAccount = new Map<string, ChallengeEntry>();

/** All credentials, keyed by credentialId for O(1) lookup. */
const credentialById = new Map<string, StoredCredential>();

/** Grouped by accountId for listing. */
const credentialsByAccount = new Map<string, StoredCredential[]>();

function indexCredential(cred: StoredCredential): void {
    credentialById.set(cred.credentialId, cred);
    const list = credentialsByAccount.get(cred.accountId) ?? [];
    if (!list.find((c) => c.credentialId === cred.credentialId)) {
        list.push(cred);
        credentialsByAccount.set(cred.accountId, list);
    }
}

// Populate indexes from disk at module load
for (const cred of loadFromDisk()) {
    indexCredential(cred);
}

// ---------------------------------------------------------------------------
// Challenge management (always in-memory — short-lived, no need to persist)
// ---------------------------------------------------------------------------

export function createChallenge(accountId: string): string {
    const challenge = randomBytes(32).toString("base64url");
    challengesByAccount.set(accountId, {
        challenge,
        accountId,
        expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });
    return challenge;
}

export function consumeChallenge(accountId: string): string | null {
    const entry = challengesByAccount.get(accountId);
    if (!entry || entry.expiresAt < Date.now()) {
        challengesByAccount.delete(accountId);
        return null;
    }
    challengesByAccount.delete(accountId);
    return entry.challenge;
}

// ---------------------------------------------------------------------------
// Credential store
// ---------------------------------------------------------------------------

export function saveCredential(cred: StoredCredential): void {
    indexCredential(cred);
    saveToDisk([...credentialById.values()]);
}

export function listCredentials(accountId: string): StoredCredential[] {
    return [...(credentialsByAccount.get(accountId) ?? [])].sort(
        (a, b) => b.registeredAt - a.registeredAt,
    );
}

export function hasCredentials(accountId: string): boolean {
    return (credentialsByAccount.get(accountId)?.length ?? 0) > 0;
}

export function findCredential(credentialId: string): StoredCredential | null {
    return credentialById.get(credentialId) ?? null;
}

export function findCredentialsForAccount(accountId: string): StoredCredential[] {
    return credentialsByAccount.get(accountId) ?? [];
}

export function updateCounter(credentialId: string, newCounter: number): void {
    const cred = credentialById.get(credentialId);
    if (!cred) return;
    cred.counter = newCounter;
    saveToDisk([...credentialById.values()]);
}

export function removeCredential(accountId: string, credentialId: string): boolean {
    const cred = credentialById.get(credentialId);
    if (!cred || cred.accountId !== accountId) return false;

    credentialById.delete(credentialId);
    const list = credentialsByAccount.get(accountId) ?? [];
    credentialsByAccount.set(
        accountId,
        list.filter((c) => c.credentialId !== credentialId),
    );
    saveToDisk([...credentialById.values()]);
    return true;
}
