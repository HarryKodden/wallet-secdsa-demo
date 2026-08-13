<template>
  <div>
    <WalletPageHeader />
    <CenterMain>
      <div>
        <section
          class="mb-6 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0">
            <h2 class="text-base font-semibold text-gray-900">Connect a mobile device</h2>
            <p class="mt-1 text-sm text-gray-700">
              Pair your phone to this account — independent of which wallet you open.
            </p>
          </div>
          <NuxtLink
            class="inline-flex shrink-0 items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
            to="/devices"
          >
            Show pairing QR
          </NuxtLink>
        </section>

        <div class="mb-2 flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">Select wallet</h2>
          <button
            class="inline-flex items-center rounded-md bg-blue-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 disabled:opacity-60"
            :disabled="creating"
            @click="onCreate"
          >
            {{ creating ? "Creating…" : "Create new wallet" }}
          </button>
        </div>

        <p v-if="error" class="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {{ error }}
        </p>

        <WalletListing
          :use-url="(wallet) => `/wallet/${wallet.id}`"
          :wallets="walletList"
          @deleted="error = ''"
          @renamed="error = ''"
        />
      </div>
    </CenterMain>
  </div>
</template>

<script setup>
import CenterMain from "@waltid-web-wallet/components/CenterMain.vue";
import WalletPageHeader from "@waltid-web-wallet/components/WalletPageHeader.vue";
import WalletListing from "@waltid-web-wallet/components/wallets/WalletListing.vue";
import {
  createNewWallet,
  listWallets,
} from "@waltid-web-wallet/composables/accountWallet.ts";

useHead({
  title: "Wallet selection - walt.id",
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
  } catch (e) {
    error.value = e?.data?.message || e?.message || String(e);
  } finally {
    creating.value = false;
  }
}

definePageMeta({
  title: "Select your wallet - walt.id",
  layout: "default-reduced-nav",
});
</script>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
