<template>
  <CenterMain>
    <h1 class="text-2xl font-semibold text-gray-900">Wallet settings</h1>
    <p class="mt-2 text-sm text-gray-600">
      Manage keys, DIDs, and issuers for this wallet. SoftHSM PIN defaults and
      demo notices live under the global
      <NuxtLink class="text-blue-600 underline" to="/settings">Settings</NuxtLink>
      page.
    </p>

    <ul class="mt-6 grid gap-3 sm:grid-cols-2">
      <li>
        <NuxtLink
          :to="`/wallet/${currentWallet}/settings/keys`"
          class="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:bg-blue-50"
        >
          <p class="font-semibold text-gray-900">Keys</p>
          <p class="mt-1 text-sm text-gray-600">SECDSA SoftHSM keys (P-256).</p>
        </NuxtLink>
      </li>
      <li>
        <NuxtLink
          :to="`/wallet/${currentWallet}/settings/dids`"
          class="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:bg-blue-50"
        >
          <p class="font-semibold text-gray-900">DIDs</p>
          <p class="mt-1 text-sm text-gray-600">Create and view <code>did:jwk</code> identifiers.</p>
        </NuxtLink>
      </li>
      <li>
        <NuxtLink
          :to="`/wallet/${currentWallet}/settings/issuers`"
          class="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:bg-blue-50"
        >
          <p class="font-semibold text-gray-900">Issuers</p>
          <p class="mt-1 text-sm text-gray-600">Trusted issuers for credential offers.</p>
        </NuxtLink>
      </li>
      <li>
        <NuxtLink
          to="/help"
          class="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:bg-blue-50"
        >
          <p class="font-semibold text-gray-900">Help</p>
          <p class="mt-1 text-sm text-gray-600">PIN unlock, receive flow, and troubleshooting.</p>
        </NuxtLink>
      </li>
    </ul>
  </CenterMain>
</template>

<script setup>
import CenterMain from "@waltid-web-wallet/components/CenterMain.vue";
import {useCurrentWallet} from "@waltid-web-wallet/composables/accountWallet.ts";

const currentWallet = useCurrentWallet();

useHead({title: "Wallet settings - walt.id"});
</script>
