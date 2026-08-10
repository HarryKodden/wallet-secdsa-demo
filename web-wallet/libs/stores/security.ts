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

    function setKey(key: CryptoKey, accountId: string) {
        prfKey.value = key;
        prfAccountId.value = accountId;
    }

    function clearKey() {
        prfKey.value = null;
        prfAccountId.value = null;
    }

    return {prfKey, prfAccountId, setKey, clearKey};
});
