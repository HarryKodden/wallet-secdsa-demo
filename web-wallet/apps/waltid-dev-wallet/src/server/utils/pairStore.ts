import {randomBytes} from "node:crypto";
import {readFileSync, writeFileSync, mkdirSync, existsSync} from "node:fs";
import {join} from "node:path";

export type PairingStatus = "pending" | "claimed" | "expired";

export type PairingRecord = {
    code: string;
    accountId: string;
    email: string;
    /** SoftHSM / WSCA account (OIDC sub mapping); optional for email/lab sessions. */
    wscaAccountId?: string;
    /** wallet-api2 JWT captured at create time (handed to the device on exchange). */
    token: string;
    createdAt: number;
    expiresAt: number;
    status: PairingStatus;
    deviceLabel?: string;
    platform?: string;
    claimedAt?: number;
};

export type RegisteredDevice = {
    id: string;
    accountId: string;
    email: string;
    label: string;
    platform: string;
    pairedAt: number;
    lastSeenAt: number;
};

// ---------------------------------------------------------------------------
// File persistence for registered devices
// ---------------------------------------------------------------------------

const DATA_DIR = process.env.WEBAUTHN_DATA_DIR || "/data";
const DEVICES_FILE = join(DATA_DIR, "paired-devices.json");

type PersistedDevices = {
    devices: RegisteredDevice[];
};

function loadDevicesFromDisk(): RegisteredDevice[] {
    try {
        if (!existsSync(DEVICES_FILE)) return [];
        const raw = readFileSync(DEVICES_FILE, "utf-8");
        const parsed = JSON.parse(raw) as PersistedDevices;
        return Array.isArray(parsed.devices) ? parsed.devices : [];
    } catch (err) {
        console.warn("[pairStore] Could not read devices file:", err);
        return [];
    }
}

function saveDevicesToDisk(devices: RegisteredDevice[]): void {
    try {
        if (!existsSync(DATA_DIR)) {
            mkdirSync(DATA_DIR, {recursive: true});
        }
        writeFileSync(DEVICES_FILE, JSON.stringify({devices}, null, 2), "utf-8");
    } catch (err) {
        console.warn("[pairStore] Could not write devices file:", err);
    }
}

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

const PAIR_TTL_MS = 5 * 60 * 1000;

/** Short-lived pairing codes — no need to persist across restarts. */
const pairings = new Map<string, PairingRecord>();

/** Registered devices — loaded from disk and kept in sync. */
const devicesByAccount = new Map<string, RegisteredDevice[]>();

// Populate from disk at module load
for (const device of loadDevicesFromDisk()) {
    const list = devicesByAccount.get(device.accountId) ?? [];
    list.push(device);
    devicesByAccount.set(device.accountId, list);
}

function allDevices(): RegisteredDevice[] {
    const all: RegisteredDevice[] = [];
    for (const list of devicesByAccount.values()) all.push(...list);
    return all;
}

function prune() {
    const now = Date.now();
    for (const [code, rec] of pairings) {
        if (rec.expiresAt <= now && rec.status === "pending") {
            rec.status = "expired";
        }
        if (rec.expiresAt < now - 60 * 60 * 1000) {
            pairings.delete(code);
        }
    }
}

export function createPairing(input: {
    accountId: string;
    email: string;
    token: string;
    wscaAccountId?: string;
}): PairingRecord {
    prune();
    const code = randomBytes(16).toString("base64url");
    const now = Date.now();
    const rec: PairingRecord = {
        code,
        accountId: input.accountId,
        email: input.email,
        wscaAccountId: input.wscaAccountId,
        token: input.token,
        createdAt: now,
        expiresAt: now + PAIR_TTL_MS,
        status: "pending",
    };
    pairings.set(code, rec);
    return rec;
}

export function getPairing(code: string): PairingRecord | null {
    prune();
    return pairings.get(code) ?? null;
}

export function claimPairing(
    code: string,
    device: {label?: string; platform?: string},
): PairingRecord {
    prune();
    const rec = pairings.get(code);
    if (!rec) {
        throw createError({statusCode: 404, statusMessage: "Unknown pairing code"});
    }
    if (rec.status === "claimed") {
        throw createError({statusCode: 409, statusMessage: "Pairing code already used"});
    }
    if (rec.expiresAt <= Date.now() || rec.status === "expired") {
        rec.status = "expired";
        throw createError({statusCode: 410, statusMessage: "Pairing code expired"});
    }

    rec.status = "claimed";
    rec.claimedAt = Date.now();
    rec.deviceLabel = device.label?.trim() || "Mobile wallet";
    rec.platform = device.platform?.trim() || "unknown";

    const deviceId = randomBytes(8).toString("hex");
    const registered: RegisteredDevice = {
        id: deviceId,
        accountId: rec.accountId,
        email: rec.email,
        label: rec.deviceLabel,
        platform: rec.platform,
        pairedAt: rec.claimedAt,
        lastSeenAt: rec.claimedAt,
    };
    const list = devicesByAccount.get(rec.accountId) ?? [];
    list.push(registered);
    devicesByAccount.set(rec.accountId, list);
    saveDevicesToDisk(allDevices());

    return rec;
}

export function listDevices(accountId: string): RegisteredDevice[] {
    return [...(devicesByAccount.get(accountId) ?? [])].sort((a, b) => b.pairedAt - a.pairedAt);
}

export function revokeDevice(accountId: string, deviceId: string): boolean {
    const list = devicesByAccount.get(accountId) ?? [];
    const next = list.filter((d) => d.id !== deviceId);
    if (next.length === list.length) return false;
    devicesByAccount.set(accountId, next);
    saveDevicesToDisk(allDevices());
    return true;
}

export function pairingDeepLink(code: string): string {
    return `primerwallet://pair?code=${encodeURIComponent(code)}`;
}

export function pairingTtlMs(): number {
    return PAIR_TTL_MS;
}

