<template>
  <CenterMain>
    <div class="mb-5 flex items-center justify-between border-b">
      <h1 class="py-3 text-2xl font-normal">DIDs</h1>
      <div class="flex gap-2">
        <button
          class="inline-flex items-center rounded-lg bg-blue-500 px-9 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          @click="createDid"
        >
          <span>New</span>
        </button>
        <button
            class="inline-flex items-center rounded-lg bg-blue-500 px-9 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            @click="importDid"
        >
          <span>Import</span>
        </button>
      </div>
    </div>

    <p
      v-if="statusSummary"
      class="mb-2 text-xs text-gray-600"
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
        v-for="did in didList"
        :key="didIdOf(did)"
        class="flex items-center justify-between gap-x-6 py-4"
      >
        <div class="min-w-0">
          <div class="flex flex-wrap items-start gap-x-3 gap-y-1">
            <p v-if="did.alias" class="mx-2 text-base font-semibold leading-6 text-gray-900">
              {{ did.alias }}
            </p>
            <span
              v-if="validityFor(didIdOf(did))"
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              :class="validityBadgeClass(validityFor(didIdOf(did))!.valid)"
              :title="validityFor(didIdOf(did))!.reason"
            >
              {{ validityLabel(validityFor(didIdOf(did))!.valid) }}
            </span>
          </div>
          <div class="flex items-start gap-x-3">
            <p
              class="mx-2 overflow-x-auto text-base font-normal leading-6 text-gray-500"
            >
              {{ didIdOf(did) }}
            </p>
          </div>
        </div>

        <div v-if="did.default" class="col-span-2 mb-1 justify-self-end">
          <span
            class="mr-1 gap-x-3 rounded-full bg-cyan-100 px-3 py-0.5 text-xs font-medium text-cyan-900"
          >
            Default
          </span>
        </div>

        <div class="flex flex-none items-center gap-x-4">
          <NuxtLink
            :to="`/wallet/${currentWallet}/settings/dids/${encodeURIComponent(didIdOf(did))}`"
            class="hidden rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:block"
          >
            View DID
          </NuxtLink>
        </div>
      </li>
    </ol>
    <p v-if="pending" class="mt-2 text-gray-500">Loading DIDs…</p>
    <p v-else-if="didList.length === 0" class="mt-2">No DIDs.</p>
  </CenterMain>
</template>

<script setup lang="ts">
import {useCurrentWallet} from "@waltid-web-wallet/composables/accountWallet.ts";
import CenterMain from "@waltid-web-wallet/components/CenterMain.vue";
import {
  fetchSecdsaStatus,
  validityBadgeClass,
  validityLabel,
  type SecdsaDidValidity,
  type SecdsaStatusResponse,
} from "@waltid-web-wallet/composables/secdsaStatus.ts";
import {useSecdsaPin} from "@waltid-web-wallet/composables/secdsaPin.ts";

const currentWallet = useCurrentWallet();
const {defaultAccountId} = useSecdsaPin();

const {data: dids, pending, refresh} = await useAsyncData(
  () => `wallet-${currentWallet.value}-dids`,
  () =>
    $fetch(`/wallet-api/wallet/${currentWallet.value}/dids`).catch(() => []),
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

const statusByDid = computed(() => {
  const map = new Map<string, SecdsaDidValidity>();
  for (const d of secdsaStatus.value?.dids ?? []) {
    map.set(d.did, d);
  }
  return map;
});

function validityFor(did: string): SecdsaDidValidity | undefined {
  return statusByDid.value.get(did);
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

const didList = computed(() => {
  const raw = dids.value;
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) =>
    typeof entry === "string" ? {did: entry} : entry,
  );
});

function didIdOf(did: { did?: string } | string) {
  if (typeof did === "string") return did;
  return did?.did ?? "";
}

function createDid() {
  navigateTo("dids/create");
}

function importDid() {
  navigateTo("dids/import");
}

useHead({
  title: "DIDs - walt.id",
});
</script>

<style scoped></style>
