<template>
    <CenterMain>
        <div class="mt-1 border p-4 rounded-2xl">
            <p class="text-base font-semibold">Generate key</p>
                <p class="mt-1 text-sm text-gray-600">
                  This demo wallet only creates SECDSA SoftHSM keys (other KMS backends are disabled).
                </p>
                <p class="mt-2 text-sm text-amber-900 bg-amber-50 ring-1 ring-amber-200 rounded-md px-3 py-2">
                  SoftHSM keeps <strong>one</strong> user key per account. Generate usually
                  <strong>re-imports</strong> that key (same
                  <code class="rounded bg-white/80 px-1">secdsa:&lt;account&gt;:1</code>) —
                  existing DIDs stay <em>WSCA OK</em>, they are not stale.
                  After a SoftHSM wipe/restart, Generate mints a new key; then delete stale DIDs,
                  create a fresh <code>did:jwk</code>, and use a <strong>new</strong> credential offer.
                </p>
            <div>
                <div
                    class="mt-1 space-y-8 border-gray-900/10 pb-12 sm:space-y-0 sm:divide-y sm:divide-gray-900/10 sm:border-t sm:pb-0">
                    <div>
                        <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-4">
                            <label class="block text-sm font-medium leading-6 text-gray-900 sm:pt-1.5" for="name">
                                Name (optional)
                            </label>
                            <div class="mt-2 sm:col-span-2 sm:mt-0">
                                <input id="name" v-model="data.name"
                                       class="px-2 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:max-w-xs sm:text-sm sm:leading-6"
                                       type="text" placeholder="e.g., My signing key"/>
                            </div>
                        </div>

                        <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-4">
                            <label class="block text-sm font-medium leading-6 text-gray-900 sm:pt-1.5"
                                   for="keyGenerationRequest">
                                KMS
                            </label>
                            <div class="mt-2 sm:col-span-2 sm:mt-0">
                                <select id="keyGenerationRequest" v-model="data.keyGenerationRequest.type"
                                        class="block px-2 w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:max-w-xs sm:text-sm sm:leading-6">
                                    <option v-for="option in options" :key="option.keyGenerationRequest[1]"
                                            :value="option.keyGenerationRequest[1]">
                                        {{ option.keyGenerationRequest[0] }}
                                    </option>
                                </select>
                                <p class="mt-2 max-w-md text-xs text-gray-500">
                                  SoftHSM keeps one user key per account. If you deleted the key from this wallet,
                                  Generate re-imports the existing SoftHSM key (same
                                  <code class="rounded bg-gray-100 px-1">secdsa:&lt;account&gt;:1</code>).
                                  Use the PIN from first-time SECDSA setup — not necessarily 424242.
                                </p>
                            </div>
                        </div>

                        <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-4">
                            <label class="block text-sm font-medium leading-6 text-gray-900 sm:pt-1.5" for="keyType">
                                Key Type
                            </label>
                            <div class="mt-2 sm:col-span-2 sm:mt-0">
                                <select id="keyType" v-model="data.type"
                                        class="block px-2 w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:max-w-xs sm:text-sm sm:leading-6">
                                    <option v-for="keyType in options[0].keyType" :key="keyType[1]" :value="keyType[1]">
                                        {{ keyType[0] }}
                                    </option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mt-1 space-y-8 border-gray-900/10 pb-12 sm:space-y-0 sm:divide-gray-900/10 sm:border-t sm:pb-0">
                    <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-2" v-for="config in options[0].config" :key="config">
                        <label class="block text-sm font-medium leading-6 text-gray-900 sm:pt-1.5">
                            {{ config.charAt(0).toUpperCase() + config.slice(1) }}
                        </label>
                        <input v-model="data.keyGenerationRequest.config[config]"
                               class="px-2 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-xs sm:text-sm sm:leading-6"
                               type="text"/>
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-2 flex items-center justify-end gap-x-6">
            <button
                class="inline-flex justify-center bg-blue-500 hover:bg-blue-600 focus-visible:outline-blue-600 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                @click="generateKey">
        <span class="inline-flex place-items-center gap-1">
          <KeyIcon v-if="!loading" class="w-5 h-5 mr-1" />
          <InlineLoadingCircle v-else class="mr-1" />
          Generate key
        </span>
            </button>
        </div>

        <div v-if="response && response !== ''" class="mt-6 border p-4 rounded-2xl">
            <p class="text-base font-semibold">Response</p>
            <div
                class="mt-1 space-y-6 border-gray-900/10 pb-6 sm:space-y-0 sm:divide-y sm:divide-gray-900/10 sm:border-t sm:pb-0">
                <p class="mt-2 flex items-center bg-green-100 p-3 rounded-xl overflow-x-scroll">
                    <CheckIcon class="w-5 h-5 mr-1 text-green-600"/>
                    <span class="text-green-800">Generated key: <code>{{ response }}</code></span>
                </p>
                <div class="pt-3 flex justify-end">
                    <NuxtLink :to="`/wallet/${currentWallet}/settings/keys`">
                        <button
                            class="mb-2 border rounded-xl p-2 bg-blue-500 text-white flex flex-row justify-center items-center">
                            <ArrowUturnLeftIcon class="h-5 pr-1"/>
                            Return back
                        </button>
                    </NuxtLink>
                </div>
            </div>
        </div>
    </CenterMain>
</template>

<script lang="ts" setup>
import CenterMain from "@waltid-web-wallet/components/CenterMain.vue";
import {ArrowUturnLeftIcon, CheckIcon, KeyIcon} from "@heroicons/vue/24/outline";
import {useCurrentWallet} from "@waltid-web-wallet/composables/accountWallet.ts";
import InlineLoadingCircle from "@waltid-web-wallet/components/loading/InlineLoadingCircle.vue";
import {useSecdsaPin} from "@waltid-web-wallet/composables/secdsaPin.ts";

const loading = ref(false);
const response = ref("");
const {promptPin, defaultAccountId, defaultBaseUrl} = useSecdsaPin();

/** Phase 2: SECDSA SoftHSM only. */
const options = ref([
  {
    keyGenerationRequest: ["SECDSA SoftHSM", "secdsa"],
    keyType: [
      ["ECDSA_Secp256r1", "secp256r1"],
    ],
    config: ["baseUrl", "accountId"]
  },
]);

const data = reactive<{
    name?: string;
    keyGenerationRequest: { type: string; config: Record<string, string> };
    type: string;
}>({
    name: '',
    keyGenerationRequest: {
        type: "secdsa",
        config: {
            baseUrl: defaultBaseUrl(),
            accountId: defaultAccountId(),
        },
    },
    type: "secp256r1",
});

const currentWallet = useCurrentWallet();

async function generateKey() {
    const config = data.keyGenerationRequest.config;
    const accountId = (config?.accountId && config.accountId.trim() !== "")
        ? config.accountId.trim()
        : defaultAccountId();
    let baseUrl = (config?.baseUrl && config.baseUrl.trim() !== "")
        ? config.baseUrl.trim()
        : defaultBaseUrl();
    baseUrl = baseUrl
        .replace("://localhost:", "://host.docker.internal:")
        .replace("://127.0.0.1:", "://host.docker.internal:");
    const pin = await promptPin(
        "Enter the SECDSA PIN for this account",
        {accountId, walletId: currentWallet.value},
    );
    if (!pin) return;

    const body: Record<string, unknown> = {
        backend: "secdsa",
        keyType: data.type,
        config: {baseUrl, accountId, pin},
    };
    if (data.name && data.name.trim() !== '') {
        body.name = data.name.trim();
    }

    loading.value = true;
    try {
        response.value = await $fetch(`/wallet-api/wallet/${currentWallet.value}/keys/generate`, {
            method: "POST",
            body,
            headers: {
                "Content-Type": "application/json",
            },
        });
        // Bust IndexedDB WSCA status cache so DID/key badges refresh immediately.
        const {fetchSecdsaStatus} = await import("@waltid-web-wallet/composables/secdsaStatus.ts");
        await fetchSecdsaStatus(currentWallet.value, accountId, {force: true});
    } catch (e: any) {
        console.error("Error generating key:", e);
        const detail =
            e?.data?.message || e?.data || e?.statusMessage || e?.message || e;
        const text = typeof detail === "string" ? detail : JSON.stringify(detail);
        alert("Failed to generate key: " + text);
    } finally {
        loading.value = false;
    }
}

useHead({
    title: "Generate key - walt.id",
});
</script>

<style scoped></style>
