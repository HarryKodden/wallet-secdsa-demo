/**
 * Track G2 — short WebAuthn / passkey presence assertion for the signing window.
 *
 * Reuses the login PRF path so SoftHSM PIN can be restored without retyping.
 * PRF material never leaves the browser.
 */

import {get as webauthnGet, parseRequestOptionsFromJSON} from "@github/webauthn-json/browser-ponyfill";
import {useSecurityStore} from "../stores/security.ts";
import {decryptPin, derivePrfKey, getOrCreateAppSalt} from "./webauthnPrf.ts";

export type PresenceResult =
    | "ok"
    | "no_credentials"
    | "unsupported"
    | "cancelled"
    | "failed";

function webauthnSupported(): boolean {
    return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

function isUserCancel(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const name = String((err as {name?: string}).name || "");
    return name === "NotAllowedError" || name === "AbortError";
}

/**
 * Assert an existing passkey for [accountId], optionally restoring the PRF-encrypted PIN.
 */
export async function assertPasskeyPresence(accountId: string): Promise<PresenceResult> {
    if (!accountId.trim()) return "failed";
    if (!webauthnSupported()) return "unsupported";

    try {
        const beginRes = await $fetch<{
            noCredentials?: boolean;
            [k: string]: unknown;
        }>("/wallet-api/auth/webauthn/authenticate/begin", {
            method: "POST",
            body: {accountId},
        });

        if (beginRes.noCredentials) {
            return "no_credentials";
        }

        const appSalt = await getOrCreateAppSalt(accountId);
        const getOpts = parseRequestOptionsFromJSON({publicKey: beginRes as any});
        getOpts.publicKey!.extensions = {
            ...(getOpts.publicKey!.extensions ?? {}),
            prf: {eval: {first: appSalt}},
        };

        const assertion = await webauthnGet(getOpts);

        const authExt = assertion.getClientExtensionResults() as {
            prf?: {results?: {first?: ArrayBuffer}};
        };
        const prfFirst = authExt.prf?.results?.first;
        const prfBytes: Uint8Array | null = prfFirst ? new Uint8Array(prfFirst) : null;
        if (prfBytes) {
            try {
                const aesKey = await derivePrfKey(prfBytes, appSalt);
                const securityStore = useSecurityStore();
                securityStore.setKey(aesKey, accountId);
                try {
                    const pinBlobRes = await $fetch<{blob: {iv: string; ct: string} | null}>(
                        `/wallet-api/auth/webauthn/wsca-pin?accountId=${encodeURIComponent(accountId)}`,
                    );
                    if (pinBlobRes?.blob) {
                        const pin = await decryptPin(aesKey, pinBlobRes.blob);
                        securityStore.setSecdsaPin(pin, accountId);
                    }
                } catch (e) {
                    console.warn("[presence] Could not restore WSCA PIN:", e);
                }
            } catch (e) {
                console.warn("[presence] PRF key derivation failed", e);
            }
        }

        const assertionJSON = assertion.toJSON();
        const assertionForServer = {
            ...assertionJSON,
            clientExtensionResults: {
                ...(assertionJSON.clientExtensionResults ?? {}),
                prf: undefined,
            },
        };

        const finishRes = await $fetch<{verified: boolean}>(
            "/wallet-api/auth/webauthn/authenticate/finish",
            {method: "POST", body: assertionForServer},
        );
        return finishRes.verified === true ? "ok" : "failed";
    } catch (err) {
        if (isUserCancel(err)) return "cancelled";
        console.warn("[presence] WebAuthn assertion failed", err);
        return "failed";
    }
}

/** True when the platform supports WebAuthn (not necessarily a registered passkey). */
export function isPasskeyPresenceAvailable(): boolean {
    return webauthnSupported();
}
