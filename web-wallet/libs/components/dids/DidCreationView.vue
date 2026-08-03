<template>
    <CenterMain>
        <BackButton />
        <div class="mt-2">
            <h2 class="text-lg font-semibold leading-7 text-gray-900">Create {{ props.method.toUpperCase() }} DID
                (did:{{ props.method }}):</h2>

            <div
                v-if="!keysLoading && keys.length === 0"
                class="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
            >
                <p class="font-semibold">This wallet has no keys yet.</p>
                <p class="mt-1">
                    Create a key first (SECDSA SoftHSM for this PoC), then come back to create the DID.
                </p>
                <div class="mt-3 flex flex-wrap gap-2">
                    <button
                        class="inline-flex items-center rounded-md bg-blue-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 disabled:opacity-60"
                        :disabled="generatingKey"
                        @click="generateSecdsaKey"
                    >
                        {{ generatingKey ? "Generating SECDSA key…" : "Generate SECDSA key now" }}
                    </button>
                    <NuxtLink
                        :to="`/wallet/${currentWallet}/settings/keys/generate`"
                        class="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                        Open key generator
                    </NuxtLink>
                </div>
                <p v-if="keyGenError" class="mt-2 text-red-800">{{ keyGenError }}</p>
            </div>

            <div class="mt-1 border p-4 rounded-2xl">
                <p class="text-base font-semibold">DID parameters</p>
                <div>
                    <div
                        class="mt-1 space-y-8 border-gray-900/10 pb-12 sm:space-y-0 sm:divide-y sm:divide-gray-900/10 sm:border-t sm:pb-0">
                        <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-2">
                            <label class="block font-medium text-gray-900">Key id</label>
                            <div class="mt-1 sm:col-span-2 sm:mt-0 space-y-2">
                                <select
                                    v-if="keys.length > 0"
                                    v-model="keyId"
                                    class="px-2 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-md sm:text-sm sm:leading-6"
                                >
                                    <option
                                        v-for="k in keys"
                                        :key="k.keyId"
                                        :value="k.keyId"
                                    >
                                        {{ k.keyId }} ({{ k.keyType }})
                                    </option>
                                </select>
                                <input
                                    v-else
                                    id="keyId"
                                    v-model="keyId"
                                    class="px-2 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-md sm:text-sm sm:leading-6"
                                    name="keyId"
                                    placeholder="Generate a key first"
                                    type="text"
                                    disabled
                                />
                            </div>
                            <label class="block font-medium text-gray-900">Alias</label>
                            <div class="mt-1 sm:col-span-2 sm:mt-0">
                                <input id="alias" v-model="alias"
                                    class="px-2 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-xs sm:text-sm sm:leading-6"
                                    name="alias" placeholder="(optional, ignored by wallet-api2)" type="text" />
                            </div>
                        </div>

                        <slot></slot>
                    </div>
                </div>

                <div class="mt-2 flex items-center justify-end gap-x-6">
                    <button
                        class="inline-flex justify-center bg-blue-500 hover:bg-blue-600 focus-visible:outline-blue-600 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
                        :disabled="loading || keys.length === 0 || !keyId"
                        @click="createDid">
                        <span class="inline-flex place-items-center gap-1">
                            <KeyIcon v-if="!loading" class="w-5 h-5 mr-1" />
                            <InlineLoadingCircle v-else class="mr-1" />
                            Create did:{{ props.method }}
                        </span>
                    </button>
                </div>
            </div>

            <div v-if="error" class="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                {{ error }}
            </div>

            <div v-if="response && response != ''" class="mt-6 border p-4 rounded-2xl">
                <p class="text-base font-semibold">Response</p>

                <div
                    class="mt-1 space-y-6 border-gray-900/10 pb-6 sm:space-y-0 sm:divide-y sm:divide-gray-900/10 sm:border-t sm:pb-0">
                    <p class="mt-2 flex items-center bg-green-100 p-3 rounded-xl overflow-x-scroll">
                        <CheckIcon class="w-5 h-5 mr-1 text-green-600" />
                        <span class="text-green-800">Created DID: <code>{{ response }}</code></span>
                    </p>

                    <div class="pt-3 flex justify-end">
                        <NuxtLink :to="`/wallet/${currentWallet}/settings/dids`">
                            <button
                                class="mb-2 border rounded-xl p-2 bg-blue-500 text-white flex flex-row justify-center items-center">
                                <ArrowUturnLeftIcon class="h-5 pr-1" />
                                Return back
                            </button>
                        </NuxtLink>
                    </div>
                </div>
            </div>
        </div>
    </CenterMain>
</template>

<script lang="ts" setup>
import {useHead} from "nuxt/app";
import {defineProps, onMounted, ref} from "vue";
import CenterMain from "../../components/CenterMain.vue";
import {CheckIcon, KeyIcon} from "@heroicons/vue/24/solid";
import {ArrowUturnLeftIcon} from "@heroicons/vue/24/outline";
import BackButton from "../../components/buttons/BackButton.vue";
import {useCurrentWallet} from "../../composables/accountWallet.ts";
import {useSecdsaPin} from "../../composables/secdsaPin.ts";
import InlineLoadingCircle from "../../components/loading/InlineLoadingCircle.vue";

const props = defineProps({
    method: {
        type: String,
        required: true,
    },
    didParams: {
        type: null,
        required: false,
        default: null,
    },
});

const loading = ref(false);
const response = ref("");
const error = ref("");
const keysLoading = ref(true);
const generatingKey = ref(false);
const keyGenError = ref("");

const keyId = ref("");
const alias = ref("");
const keys = ref<{ keyId: string; keyType?: string }[]>([]);

const currentWallet = useCurrentWallet();
const {ensureUnlocked, defaultAccountId, defaultBaseUrl} = useSecdsaPin();

async function loadKeys() {
    keysLoading.value = true;
    try {
        keys.value = (await $fetch(`/wallet-api/wallet/${currentWallet.value}/keys`)) ?? [];
        const secdsa = keys.value.find((k) => k.keyId?.startsWith("secdsa:"));
        keyId.value = secdsa?.keyId ?? keys.value[0]?.keyId ?? "";
    } catch (e) {
        console.warn("Could not load keys for DID create", e);
        keys.value = [];
    } finally {
        keysLoading.value = false;
    }
}

onMounted(loadKeys);

async function generateSecdsaKey() {
    generatingKey.value = true;
    keyGenError.value = "";
    error.value = "";
    try {
        const unlocked = await ensureUnlocked({
            title: "Enter SECDSA PIN to generate a key",
        });
        if (!unlocked) return;

        const created = await $fetch<{ keyId?: string }>(
            `/wallet-api/wallet/${currentWallet.value}/keys/generate`,
            {
                method: "POST",
                body: {
                    backend: "secdsa",
                    keyType: "secp256r1",
                    config: {
                        baseUrl: defaultBaseUrl(),
                        accountId: defaultAccountId(),
                    },
                },
            },
        );
        await loadKeys();
        if (created?.keyId) keyId.value = created.keyId;
    } catch (e: any) {
        const detail = e?.data?.message || e?.data || e?.statusMessage || e?.message || e;
        keyGenError.value = typeof detail === "string" ? detail : JSON.stringify(detail);
    } finally {
        generatingKey.value = false;
    }
}

async function createDid() {
    loading.value = true;
    error.value = "";
    response.value = "";

    if (!keyId.value?.trim()) {
        error.value = "Select or generate a key before creating a DID.";
        loading.value = false;
        return;
    }

    const options: Record<string, string | boolean | number> = {};
    const params = (props.didParams ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === "") continue;
        options[k] = v as string | boolean | number;
    }

    const body: Record<string, unknown> = {
        method: props.method,
        keyId: keyId.value.trim(),
    };
    if (Object.keys(options).length > 0) body.options = options;

    try {
        // SECDSA keys may need an unlocked SoftHSM session for public-key material
        if (keyId.value.startsWith("secdsa:")) {
            const unlocked = await ensureUnlocked({
                title: "Enter SECDSA PIN to create DID",
            });
            if (!unlocked) {
                error.value = "PIN required to use the SECDSA key.";
                return;
            }
        }

        const created = await $fetch<{ did?: string } | string>(
            `/wallet-api/wallet/${currentWallet.value}/dids/create`,
            {
                method: "POST",
                body,
            },
        );
        response.value = typeof created === "string" ? created : (created?.did ?? JSON.stringify(created));
    } catch (e: any) {
        const detail = e?.data?.message || e?.data || e?.statusMessage || e?.message || e;
        error.value = typeof detail === "string" ? detail : JSON.stringify(detail);
    } finally {
        loading.value = false;
    }
}

useHead({
    title: `Create did:${props.method} - walt.id`,
});
</script>

<style scoped></style>
