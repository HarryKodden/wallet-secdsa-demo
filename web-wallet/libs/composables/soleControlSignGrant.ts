/**
 * Track G2 — consent + presence → mint SignGrant for holder SIGN.
 *
 * When `SOLE_CONTROL_SIGNING` is off (status.soleControlSigning !== true),
 * callers keep the legacy `ensureUnlocked` path.
 */

import {markRaw, watch} from "vue";
import SoleControlConsentModal from "../components/modals/SoleControlConsentModal.vue";
import {useSecurityStore} from "../stores/security.ts";
import useModalStore from "../stores/useModalStore.ts";
import {fetchSecdsaStatus} from "./secdsaStatus.ts";
import {useSecdsaPin} from "./secdsaPin.ts";
import {assertPasskeyPresence} from "./webauthnPresence.ts";

export type SignGrantPurpose = "issuance" | "presentation";

export type SignGrantBinding = {
    offerId?: string;
    requestHash?: string;
    clientId?: string;
};

export type ConsentSummary = {
    title: string;
    party?: string;
    detail?: string;
    confirmLabel?: string;
};

export type HolderSignAuth =
    | {mode: "legacy"}
    | {mode: "grant"; signGrant: string; keyId: string}
    | {mode: "cancelled"; reason?: string};

const CONSENT_STORAGE_PREFIX = "soleControlConsent:";

function keyIdOf(key: unknown): string {
    if (!key || typeof key !== "object") return "";
    const k = key as {keyId?: string | {id?: string}; id?: string};
    if (typeof k.keyId === "string") return k.keyId;
    if (k.keyId && typeof k.keyId === "object" && typeof k.keyId.id === "string") {
        return k.keyId.id;
    }
    return typeof k.id === "string" ? k.id : "";
}

export async function resolveSecdsaKeyId(
    walletId: string,
    accountId?: string,
): Promise<string | null> {
    try {
        const keys = (await $fetch<unknown[]>(`/wallet-api/wallet/${walletId}/keys`)) ?? [];
        const secdsa = keys.map(keyIdOf).filter((id) => id.startsWith("secdsa:"));
        if (!secdsa.length) return null;
        if (accountId) {
            const prefix = `secdsa:${accountId}:`;
            const match = secdsa.find((id) => id.startsWith(prefix));
            if (match) return match;
        }
        return secdsa[0] ?? null;
    } catch (e) {
        console.warn("[soleControl] Could not list keys:", e);
        return null;
    }
}

export function promptConsent(summary: ConsentSummary): Promise<boolean> {
    return new Promise((resolve) => {
        const modalStore = useModalStore();
        let settled = false;
        const settle = (ok: boolean) => {
            if (settled) return;
            settled = true;
            stopWatch();
            if (modalStore.modalState.component) {
                modalStore.closeModal();
            }
            resolve(ok);
        };

        modalStore.openModal({
            component: markRaw(SoleControlConsentModal),
            props: {
                title: summary.title,
                party: summary.party,
                detail: summary.detail,
                confirmLabel: summary.confirmLabel,
                onConfirm: () => settle(true),
                onCancel: () => settle(false),
            },
        });

        const stopWatch = watch(
            () => modalStore.modalState.component,
            (component) => {
                if (!component) settle(false);
            },
        );
    });
}

/** Consent sheet when sole-control is on; otherwise no-op (returns true). */
export async function ensureAcceptConsent(opts: {
    walletId: string;
    accountId: string;
    summary: ConsentSummary;
}): Promise<boolean> {
    const status = await fetchSecdsaStatus(opts.walletId, opts.accountId, {force: true});
    if (!status?.soleControlSigning) return true;
    return promptConsent(opts.summary);
}

export function rememberIssuanceConsent(walletId: string): void {
    try {
        sessionStorage.setItem(
            `${CONSENT_STORAGE_PREFIX}issuance`,
            JSON.stringify({walletId, at: Date.now()}),
        );
    } catch {
        /* ignore */
    }
}

export function consumeIssuanceConsent(walletId: string, maxAgeMs = 15 * 60_000): boolean {
    try {
        const raw = sessionStorage.getItem(`${CONSENT_STORAGE_PREFIX}issuance`);
        if (!raw) return false;
        sessionStorage.removeItem(`${CONSENT_STORAGE_PREFIX}issuance`);
        const parsed = JSON.parse(raw) as {walletId?: string; at?: number};
        if (parsed.walletId !== walletId) return false;
        if (typeof parsed.at !== "number" || Date.now() - parsed.at > maxAgeMs) return false;
        return true;
    } catch {
        return false;
    }
}

/**
 * When sole-control is on: consent → passkey presence → PIN (PRF or modal) → authorize-sign.
 * When off: `{ mode: "legacy" }` so the caller can use `ensureUnlocked`.
 */
export async function authorizeHolderSign(opts: {
    walletId: string;
    accountId: string;
    purpose: SignGrantPurpose;
    summary: ConsentSummary;
    keyId?: string | null;
    binding?: SignGrantBinding;
    /** Skip consent sheet (e.g. auth-code callback after Accept already consented). */
    skipConsent?: boolean;
}): Promise<HolderSignAuth> {
    const {walletId, accountId, purpose, summary} = opts;
    const status = await fetchSecdsaStatus(walletId, accountId, {force: true});

    if (!status?.soleControlSigning) {
        return {mode: "legacy"};
    }

    if (!opts.skipConsent) {
        const ok = await promptConsent(summary);
        if (!ok) return {mode: "cancelled", reason: "consent_declined"};
    }

    const presence = await assertPasskeyPresence(accountId);
    if (presence === "cancelled") {
        return {mode: "cancelled", reason: "presence_cancelled"};
    }
    if (presence === "failed") {
        return {mode: "cancelled", reason: "presence_failed"};
    }
    // unsupported / no_credentials → continue with PIN step-up only

    const {promptPin, defaultAccountId} = useSecdsaPin();
    const securityStore = useSecurityStore();
    let pin =
        securityStore.secdsaPin && securityStore.secdsaPinAccountId === accountId
            ? securityStore.secdsaPin
            : null;

    if (!pin) {
        // PIN only — authorize-sign unlocks SoftHSM once; do not open a legacy PIN session.
        pin = await promptPin(
            presence === "unsupported" || presence === "no_credentials"
                ? "Enter SECDSA PIN (passkey unavailable) to authorize signing"
                : "Enter SECDSA PIN to authorize this signing act",
            {accountId: accountId || defaultAccountId(), mode: "unlock"},
        );
        if (!pin) return {mode: "cancelled", reason: "pin_cancelled"};
        securityStore.setSecdsaPin(pin, accountId);
    }

    const keyId =
        opts.keyId?.trim() ||
        (await resolveSecdsaKeyId(walletId, accountId)) ||
        "";
    if (!keyId) {
        return {mode: "cancelled", reason: "no_secdsa_key"};
    }

    try {
        const minted = await $fetch<{
            signGrant: string;
            ttlSeconds?: number;
            keyId: string;
        }>(`/wallet-api/wallet/${walletId}/keys/secdsa/authorize-sign`, {
            method: "POST",
            body: {
                accountId,
                keyId,
                purpose,
                pin,
                ...(opts.binding ? {binding: opts.binding} : {}),
            },
        });

        const ttlMs =
            typeof minted.ttlSeconds === "number" && minted.ttlSeconds > 0
                ? minted.ttlSeconds * 1000
                : undefined;
        securityStore.openSigningWindow(ttlMs);
        securityStore.setPendingSignGrant(minted.signGrant);

        return {mode: "grant", signGrant: minted.signGrant, keyId: minted.keyId || keyId};
    } catch (e: unknown) {
        console.warn("[soleControl] authorize-sign failed", e);
        return {mode: "cancelled", reason: "authorize_sign_failed"};
    }
}

export function useSoleControlSignGrant() {
    return {
        authorizeHolderSign,
        resolveSecdsaKeyId,
        rememberIssuanceConsent,
        consumeIssuanceConsent,
        ensureAcceptConsent,
        promptConsent,
    };
}
