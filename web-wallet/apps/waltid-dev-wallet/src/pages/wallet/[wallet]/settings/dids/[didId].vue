<template>
  <CenterMain>
    <BackButton />
    <LoadingIndicator v-if="pending">Loading DID...</LoadingIndicator>
    <div v-else>
      <div class="flex space-x-3">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-gray-900 whitespace-pre-wrap">
            DID: {{ didId }}
          </p>
          <p class="text-sm text-gray-500">DID document data below:</p>
        </div>
      </div>
      <div v-if="didDoc">
        <div class="mt-6 border p-4 rounded-2xl">
          <p class="text-base font-semibold">DID information</p>
          <div>
            <div
              class="mt-1 space-y-8 border-gray-900/10 pb-12 sm:space-y-0 sm:divide-y sm:divide-gray-900/10 sm:border-t sm:pb-0"
            >
              <div
                class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-2"
              >
                <label class="block font-medium text-gray-900"
                  >Identifier
                </label>
                <div class="mt-1 sm:col-span-2 sm:mt-0 overflow-x-scroll">
                  {{ didId }}
                </div>
              </div>
            </div>
          </div>

          <p v-if="actionError" class="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {{ actionError }}
          </p>

          <div class="mt-2 flex items-center justify-end gap-x-6">
            <button
              class="inline-flex justify-center bg-red-600 hover:bg-red-500 focus-visible:outline-red-700 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
              :disabled="deleting"
              @click="deleteDid"
            >
              <span class="inline-flex place-items-center gap-1">
                <TrashIcon class="w-5 h-5 mr-0.5" />
                {{ deleting ? "Deleting…" : "Delete DID" }}
              </span>
            </button>
          </div>
          <div class="mt-2 flex items-center justify-end gap-x-6">
            <button
              class="inline-flex justify-center bg-gray-600 hover:bg-gray-400 focus-visible:outline-gray-700 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              @click="setDefault"
            >
              <span class="inline-flex place-items-center gap-1">
                <TagIcon class="w-5 h-5 mr-0.5" />
                Set default DID
              </span>
            </button>
          </div>
        </div>
        <div class="p-3 shadow mt-3">
          <h3 class="font-semibold mb-2">QR code</h3>
          <qrcode-vue
            v-if="didDoc && JSON.stringify(didDoc).length <= 4296"
            :value="JSON.stringify(didDoc)"
            level="L"
            size="300"
          ></qrcode-vue>
          <p v-else-if="didDoc && JSON.stringify(didDoc).length">
            Unfortunately, this DID document is too big to be viewable as QR
            code (DID document size is {{ didDoc.length }} characters, but the
            maximum a QR code can hold is 4296).
            {{ JSON.stringify(didDoc).length }}
          </p>
          <p v-else>No DID document could be loaded!</p>
        </div>
        <div class="shadow p-3 mt-2 font-mono overflow-scroll">
          <h3 class="font-semibold mb-2">JSON</h3>
          <pre>{{ didDoc ? JSON.stringify(didDoc, null, 2) : "No DID" }}</pre>
        </div>
      </div>
      <div
        v-else
        v-if="!pending"
        class="p-3 shadow mt-3 bg-red-200 border-red-300 border"
      >
        <h3 class="font-semibold text-red-500">The DID could not be loaded.</h3>
      </div>
    </div>
  </CenterMain>
</template>

<script lang="ts" setup>
import LoadingIndicator from "@waltid-web-wallet/components/loading/LoadingIndicator.vue";
import QrcodeVue from "qrcode.vue";
import CenterMain from "@waltid-web-wallet/components/CenterMain.vue";
import BackButton from "@waltid-web-wallet/components/buttons/BackButton.vue";
import {useCurrentWallet} from "@waltid-web-wallet/composables/accountWallet.ts";
import {TagIcon, TrashIcon} from "@heroicons/vue/24/outline";
import {computed} from "vue";

const route = useRoute();

const rawParam = route.params.didId;
const didId = decodeURIComponent(
  Array.isArray(rawParam) ? rawParam[0] : String(rawParam ?? ""),
);

const currentWallet = useCurrentWallet();
const deleting = ref(false);
const actionError = ref("");

const {
  data: didEntry,
  pending,
} = await useAsyncData(
  () => `wallet-${currentWallet.value}-did-${didId}`,
  () =>
    $fetch(`/wallet-api/wallet/${currentWallet.value}/dids`, {
      // Prefer list + local match to avoid path-encoding issues for did:jwk
      query: {},
    }).then((list: any) => {
      const arr = Array.isArray(list) ? list : [];
      const found = arr.find((e) => (typeof e === "string" ? e : e?.did) === didId);
      if (found) return typeof found === "string" ? {did: found} : found;
      // Fallback: path GET (encoded)
      return $fetch(
        `/wallet-api/wallet/${currentWallet.value}/dids/${encodeURIComponent(didId)}`,
      );
    }),
  {watch: [currentWallet]},
);

const didDoc = computed(() => {
  const entry = didEntry.value;
  if (!entry) return null;
  return entry.document ?? entry;
});

async function deleteDid() {
  deleting.value = true;
  actionError.value = "";
  try {
    // Query-param delete — browsers/$fetch often decode path `%3A` back to `:`,
    // which breaks path-based DELETE for did:jwk / did:key.
    await $fetch(`/wallet-api/wallet/${currentWallet.value}/dids`, {
      method: "DELETE",
      query: {did: didId},
    });
    await navigateTo(`/wallet/${currentWallet.value}/settings/dids`);
  } catch (e: any) {
    const detail = e?.data?.message || e?.data || e?.statusMessage || e?.message || e;
    actionError.value = typeof detail === "string" ? detail : JSON.stringify(detail);
  } finally {
    deleting.value = false;
  }
}

async function setDefault() {
  actionError.value = "";
  try {
    await $fetch(
      `/wallet-api/wallet/${currentWallet.value}/dids/${encodeURIComponent(didId)}/set-default`,
      {method: "PUT"},
    );
  } catch (e: any) {
    const detail = e?.data?.message || e?.data || e?.statusMessage || e?.message || e;
    actionError.value = typeof detail === "string" ? detail : JSON.stringify(detail);
  }
}

useHead({
  title: "View DID - walt.id",
});
</script>

<style scoped></style>
