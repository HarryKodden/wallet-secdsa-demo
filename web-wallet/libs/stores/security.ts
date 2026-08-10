import {defineStore} from "pinia";
import {ref} from "vue";

/**
 * Holds PRF-derived secrets for this browser session.
 * Memory only — never serialised, never sent to any server.
 * Cleared on page close / session end automatically (no localStorage/IndexedDB).
 */
export const useSecurityStore = defineStore("securityStore", () => {
    /** AES-GCM-256 key derived from the passkey's PRF output. null when PRF unavailable. */
    const prfKey = ref<CryptoKey | null>(null);

    /** accountId of the session this key belongs to (for cross-check). */
    const prfAccountId = ref<string | null>(null);

    /**
     * Plaintext SECDSA/WSCA PIN — decrypted from the server-stored PRF-encrypted blob
     * after a successful passkey assertion, or captured after first-time modal entry.
     * Never written to localStorage/IndexedDB; cleared together with the PRF key.
     */
    const secdsaPin = ref<string | null>(null);

    /** accountId the cached secdsaPin was validated for. */
    const secdsaPinAccountId = ref<string | null>(null);

    function setKey(key: CryptoKey, accountId: string) {
        prfKey.value = key;
        prfAccountId.value = accountId;
    }

    /**
     * Store (or clear) the SECDSA PIN for the given accountId.
     * Pass null to invalidate the cached PIN (e.g. after a rejected unlock).
     */
    function setSecdsaPin(pin: string | null, accountId: string) {
        secdsaPin.value = pin;
        secdsaPinAccountId.value = pin !== null ? accountId : null;
    }

    function clearKey() {
        prfKey.value = null;
        prfAccountId.value = null;
        secdsaPin.value = null;
        secdsaPinAccountId.value = null;
    }

    return {prfKey, prfAccountId, secdsaPin, secdsaPinAccountId, setKey, setSecdsaPin, clearKey};
});
