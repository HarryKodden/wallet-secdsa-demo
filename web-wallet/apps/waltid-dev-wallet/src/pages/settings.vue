<template>
  <CenterMain>
    <div class="max-w-3xl">
      <h1 class="text-2xl font-semibold text-gray-900">Settings</h1>
      <p class="mt-2 text-sm text-gray-600">
        Demo wallet preferences for the walt.id + SECDSA educational stack.
        Private keys stay in SoftHSM; this page only shows how the wallet is wired.
      </p>

      <section class="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <p class="font-semibold">Educational / PoC only</p>
        <p class="mt-1">
          SECDSA is patent-encumbered. Do not use this stack for production or commercial
          deployments without a license — see the
          <NuxtLink class="underline" to="/help/privacy">privacy &amp; usage notice</NuxtLink>.
        </p>
      </section>

      <section class="mt-8">
        <h2 class="text-lg font-semibold text-gray-900">SECDSA SoftHSM</h2>
        <dl class="mt-3 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white text-sm">
          <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt class="font-medium text-gray-500">Lab account</dt>
            <dd class="sm:col-span-2 font-mono text-gray-900">{{ accountId }}</dd>
          </div>
          <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt class="font-medium text-gray-500">Default PIN</dt>
            <dd class="sm:col-span-2 font-mono text-gray-900">
              {{ pinHint }}
              <span class="ml-2 text-gray-500">(lab default — change in the SECDSA UI for real demos)</span>
            </dd>
          </div>
          <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt class="font-medium text-gray-500">WSCA base URL</dt>
            <dd class="sm:col-span-2 break-all font-mono text-gray-900">{{ wscaBaseUrl }}</dd>
          </div>
          <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt class="font-medium text-gray-500">PIN session</dt>
            <dd class="sm:col-span-2 text-gray-900">
              The wallet prompts for the PIN before GENKEY / SIGN and calls
              <code class="rounded bg-gray-100 px-1">POST /wallet/&#123;id&#125;/keys/secdsa/unlock</code>.
              The PIN is kept in wallet-api2 process memory for the SoftHSM session — not stored in the browser.
            </dd>
          </div>
        </dl>
        <p class="mt-3 text-sm text-gray-600">
          SoftHSM lab UI:
          <a
            class="font-medium text-blue-600 underline hover:text-blue-700"
            href="http://localhost:18080"
            rel="noopener noreferrer"
            target="_blank"
          >http://localhost:18080</a>
        </p>
      </section>

      <section class="mt-8">
        <h2 class="text-lg font-semibold text-gray-900">This wallet</h2>
        <p v-if="!currentWallet" class="mt-2 text-sm text-gray-600">
          No wallet selected yet. Open a wallet from the home screen to manage keys and DIDs.
        </p>
        <ul v-else class="mt-3 grid gap-3 sm:grid-cols-2">
          <li>
            <NuxtLink
              :to="`/wallet/${currentWallet}/settings/keys`"
              class="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:bg-blue-50"
            >
              <p class="font-semibold text-gray-900">Keys</p>
              <p class="mt-1 text-sm text-gray-600">Generate or inspect SECDSA (P-256) keys.</p>
            </NuxtLink>
          </li>
          <li>
            <NuxtLink
              :to="`/wallet/${currentWallet}/settings/dids`"
              class="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:bg-blue-50"
            >
              <p class="font-semibold text-gray-900">DIDs</p>
              <p class="mt-1 text-sm text-gray-600">Create <code>did:jwk</code> from your SoftHSM key.</p>
            </NuxtLink>
          </li>
          <li>
            <NuxtLink
              :to="`/wallet/${currentWallet}/settings/issuers`"
              class="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:bg-blue-50"
            >
              <p class="font-semibold text-gray-900">Trusted issuers</p>
              <p class="mt-1 text-sm text-gray-600">Issuer list used when receiving credentials.</p>
            </NuxtLink>
          </li>
          <li>
            <NuxtLink
              :to="`/wallet/${currentWallet}`"
              class="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-300 hover:bg-blue-50"
            >
              <p class="font-semibold text-gray-900">Credentials</p>
              <p class="mt-1 text-sm text-gray-600">Back to the credential list for this wallet.</p>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <section class="mt-8 mb-10">
        <h2 class="text-lg font-semibold text-gray-900">API endpoints</h2>
        <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>
            Wallet API Swagger:
            <a class="text-blue-600 underline" href="http://localhost:7006/swagger" target="_blank" rel="noopener noreferrer">:7006</a>
          </li>
          <li>
            Issuer API Swagger:
            <a class="text-blue-600 underline" href="http://localhost:7005/swagger" target="_blank" rel="noopener noreferrer">:7005</a>
          </li>
          <li>
            Verifier API Swagger:
            <a class="text-blue-600 underline" href="http://localhost:7004/swagger" target="_blank" rel="noopener noreferrer">:7004</a>
          </li>
        </ul>
        <p class="mt-4 text-sm text-gray-600">
          Need a walkthrough?
          <NuxtLink class="font-medium text-blue-600 underline" to="/help">Open Help</NuxtLink>
        </p>
      </section>
    </div>
  </CenterMain>
</template>

<script setup lang="ts">
import CenterMain from "@waltid-web-wallet/components/CenterMain.vue";
import {useCurrentWallet} from "@waltid-web-wallet/composables/accountWallet.ts";

definePageMeta({
  layout: "default-reduced-nav",
});

const config = useRuntimeConfig();
const currentWallet = useCurrentWallet();

const accountId = computed(
  () => (config.public.wscaAccountId as string | undefined) || "citizen-42",
);
const wscaBaseUrl = computed(
  () => (config.public.wscaBaseUrl as string | undefined) || "http://secdsa:8080",
);
const pinHint = "424242";

useHead({title: "Settings - walt.id"});
</script>
