<template>
  <CenterMain>
    <div class="flex justify-between items-center">
      <h1 class="text-lg font-semibold">Your keys:</h1>

      <div class="flex justify-between gap-2">
        <button
            class="inline-flex items-center bg-blue-500 hover:bg-blue-600 focus-visible:outline-blue-600 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            @click="signAndverify"
        >
          <HashtagIcon
              aria-hidden="true"
              class="h-5 w-5 text-white mr-1"
          />
          <span>Sign & Verify</span>
        </button>
        <button
          class="inline-flex items-center bg-blue-500 hover:bg-blue-600 focus-visible:outline-blue-600 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          @click="importKey"
        >
          <InboxArrowDownIcon
            aria-hidden="true"
            class="h-5 w-5 text-white mr-1"
          />
          <span>Import key</span>
        </button>

        <button
          class="inline-flex items-center bg-blue-500 hover:bg-blue-600 focus-visible:outline-blue-600 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          @click="generateKey"
        >
          <KeyIcon aria-hidden="true" class="h-5 w-5 text-white mr-1" />
          <span>Generate key</span>
        </button>
      </div>
    </div>

    <p
      v-if="statusSummary"
      class="mt-2 text-xs text-gray-600"
      :title="statusSummary.detail"
    >
      WSCA:
      <span class="font-medium">{{ statusSummary.label }}</span>
      <button
        type="button"
        class="ml-2 underline text-gray-800"
        @click="refreshStatus"
      >
        Refresh
      </button>
    </p>

    <ol
      class="divide-y divide-gray-100 list-decimal border rounded-2xl mt-2 px-2"
      role="list"
    >
      <li
        v-for="key in keyList"
        :key="keyIdOf(key)"
        class="flex items-center justify-between gap-x-6 py-4"
      >
        <div class="min-w-0">
          <div class="flex items-start gap-x-3">
            <p class="mx-2 text-base font-semibold leading-6 text-gray-900">
              {{ key.algorithm || key.keyType || "key" }}
            </p>
            <span
              v-if="validityFor(keyIdOf(key))"
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              :class="validityBadgeClass(validityFor(keyIdOf(key))!.valid)"
              :title="validityFor(keyIdOf(key))!.reason"
            >
              {{ validityLabel(validityFor(keyIdOf(key))!.valid) }}
            </span>
          </div>
          <div class="flex items-start gap-x-3">
            <p
              class="mx-2 overflow-x-auto text-base font-normal leading-6 text-gray-500"
            >
                {{ key.name || keyIdOf(key) }}
            </p>
          </div>
        </div>
        <div class="flex flex-none items-center gap-x-4">
          <NuxtLink
            :to="`/wallet/${currentWallet}/settings/keys/${encodeURIComponent(keyIdOf(key))}`"
            class="hidden rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:block"
          >
            View key
          </NuxtLink>
        </div>
      </li>
    </ol>
    <p v-if="pending" class="mt-2 text-gray-500">Loading keys…</p>
    <p v-else-if="keyList.length === 0" class="mt-2">No keys.</p>
  </CenterMain>
</template>

<script lang="ts" setup>
import CenterMain from "@waltid-web-wallet/components/CenterMain.vue";
import {useCurrentWallet} from "@waltid-web-wallet/composables/accountWallet.ts";
import {
  fetchSecdsaStatus,
  validityBadgeClass,
  validityLabel,
  type SecdsaKeyValidity,
  type SecdsaStatusResponse,
} from "@waltid-web-wallet/composables/secdsaStatus.ts";
import {useSecdsaPin} from "@waltid-web-wallet/composables/secdsaPin.ts";
import {HashtagIcon, InboxArrowDownIcon, KeyIcon} from "@heroicons/vue/24/outline";

const currentWallet = useCurrentWallet();
const {defaultAccountId} = useSecdsaPin();

function keyIdOf(key: any): string {
  if (!key) return "";
  if (typeof key.keyId === "string") return key.keyId;
  if (key.keyId?.id) return key.keyId.id;
  return String(key.id ?? "");
}

const {data: keys, pending, refresh} = await useAsyncData(
  () => `wallet-${currentWallet.value}-keys`,
  () =>
    $fetch<any[]>(`/wallet-api/wallet/${currentWallet.value}/keys`).catch(() => []),
  {
    watch: [currentWallet],
    default: () => [],
  },
);

const secdsaStatus = ref<SecdsaStatusResponse | null>(null);

async function refreshStatus() {
  const id = currentWallet.value;
  if (!id) {
    secdsaStatus.value = null;
    return;
  }
  secdsaStatus.value = await fetchSecdsaStatus(id, defaultAccountId());
}

const statusByKeyId = computed(() => {
  const map = new Map<string, SecdsaKeyValidity>();
  for (const k of secdsaStatus.value?.keys ?? []) {
    map.set(k.keyId, k);
  }
  return map;
});

function validityFor(keyId: string): SecdsaKeyValidity | undefined {
  return statusByKeyId.value.get(keyId);
}

const statusSummary = computed(() => {
  const s = secdsaStatus.value;
  if (!s) return null;
  if (!s.reachable) {
    return {label: s.error || "unreachable", detail: s.error || ""};
  }
  const parts = [
    s.activated ? "activated" : "not activated",
    s.hasUserKey ? "has user key" : "no user key",
    s.backend || "backend?",
  ];
  return {label: parts.join(" · "), detail: s.wscaPublicKeyHex || ""};
});

onMounted(() => {
  refresh();
  refreshStatus();
});

watch(currentWallet, () => {
  refreshStatus();
});

const keyList = computed(() => (Array.isArray(keys.value) ? keys.value : []));

function generateKey() {
  navigateTo("keys/generate");
}

function importKey() {
  navigateTo("keys/import");
}

function signAndverify() {
  navigateTo("keys/sign-verify");
}

useHead({
  title: "Keys - walt.id",
});
</script>

<style scoped></style>
