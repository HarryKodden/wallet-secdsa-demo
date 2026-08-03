<template>
  <CenterMain>
    <div class="mb-4 flex justify-between items-center gap-3">
      <h1 class="text-lg font-semibold">Select wallet</h1>

      <button
        class="inline-flex items-center bg-blue-500 hover:bg-blue-600 focus-visible:outline-blue-600 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
        :disabled="creating"
        @click="onCreate"
      >
        <InboxArrowDownIcon aria-hidden="true" class="h-5 w-5 text-white mr-1" />
        <span>{{ creating ? "Creating…" : "Create new wallet" }}</span>
      </button>
    </div>

    <p v-if="error" class="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
      {{ error }}
    </p>

    <WalletListing
      :use-url="(wallet) => `/wallet/${wallet.id}`"
      :wallets="walletList"
    />
  </CenterMain>
</template>

<script lang="ts" setup>
import {InboxArrowDownIcon} from "@heroicons/vue/24/outline";
import CenterMain from "@waltid-web-wallet/components/CenterMain.vue";
import WalletListing from "@waltid-web-wallet/components/wallets/WalletListing.vue";
import {
  createNewWallet,
  listWallets,
} from "@waltid-web-wallet/composables/accountWallet.ts";

useHead({
  title: "Select wallet - walt.id",
});

const wallets = await listWallets();
const walletList = computed(() => wallets.value?.wallets ?? []);

const creating = ref(false);
const error = ref("");

async function onCreate() {
  creating.value = true;
  error.value = "";
  try {
    await createNewWallet(true);
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || String(e);
  } finally {
    creating.value = false;
  }
}
</script>

<style scoped></style>
