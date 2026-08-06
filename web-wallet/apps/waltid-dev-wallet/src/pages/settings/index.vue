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

      <section class="mt-8 rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
        <h2 class="text-lg font-semibold text-gray-900">Mobile devices</h2>
        <p class="mt-1 text-sm text-gray-700">
          Sign in here with SURF (OIDC), then show a QR code for the phone to pair.
          The mobile app unlocks with biometrics only — no password on the device.
        </p>
        <NuxtLink
          class="mt-3 inline-flex rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          to="/devices"
        >
          Connect a mobile device
        </NuxtLink>
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

      <section v-if="showAsConfig" class="mt-8">
        <h2 class="text-lg font-semibold text-gray-900">OID4VCI authorization server</h2>
        <p class="mt-2 text-sm text-gray-600">
          Configured for local issuer authorization-code offers (Lab). Issuer IdP
          client and wallet OID4VCI client are different OAuth clients.
        </p>
        <dl class="mt-3 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white text-sm">
          <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt class="font-medium text-gray-500">Lab auth-code</dt>
            <dd class="sm:col-span-2 text-gray-900">
              <span
                class="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold"
                :class="
                  labConfig?.authCodeEnabled
                    ? 'bg-emerald-100 text-emerald-900'
                    : 'bg-gray-100 text-gray-700'
                "
              >
                {{ labConfig?.authCodeEnabled ? "Enabled" : "Disabled" }}
              </span>
            </dd>
          </div>
          <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt class="font-medium text-gray-500">Issuer AS authorize URL</dt>
            <dd class="sm:col-span-2 break-all font-mono text-gray-900">
              {{ labConfig?.issuerAs?.authorizeUrl || "—" }}
            </dd>
          </div>
          <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt class="font-medium text-gray-500">Issuer AS token URL</dt>
            <dd class="sm:col-span-2 break-all font-mono text-gray-900">
              {{ labConfig?.issuerAs?.tokenUrl || "—" }}
            </dd>
          </div>
          <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt class="font-medium text-gray-500">Issuer AS client ID</dt>
            <dd class="sm:col-span-2 font-mono text-gray-900">
              {{ labConfig?.issuerAs?.clientId || "—" }}
            </dd>
          </div>
          <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt class="font-medium text-gray-500">Wallet OID4VCI client ID</dt>
            <dd class="sm:col-span-2 font-mono text-gray-900">
              {{ labConfig?.oid4vci?.clientId || "—" }}
            </dd>
          </div>
          <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt class="font-medium text-gray-500">Wallet redirect URI</dt>
            <dd class="sm:col-span-2 break-all font-mono text-gray-900">
              {{ labConfig?.oid4vci?.redirectUri || "—" }}
            </dd>
          </div>
        </dl>
        <p class="mt-3 text-sm text-gray-600">
          Set via <code class="rounded bg-gray-100 px-1">ISSUER_AS_*</code> and
          <code class="rounded bg-gray-100 px-1">OID4VCI_*</code> in
          <code class="rounded bg-gray-100 px-1">.env</code> (secret is not shown).
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

type LabConfig = {
  authCodeEnabled: boolean;
  issuerAs: {
    authorizeUrl: string | null;
    tokenUrl: string | null;
    clientId: string | null;
    isDemoDefault: boolean;
  };
  oid4vci: {
    clientId: string;
    redirectUri: string;
  };
};

const labConfig = ref<LabConfig | null>(null);

/** Show when a non-demo issuer AS is configured or Lab auth-code is enabled. */
const showAsConfig = computed(() => {
  const c = labConfig.value;
  if (!c) return false;
  if (c.authCodeEnabled) return true;
  return Boolean(c.issuerAs?.authorizeUrl) && !c.issuerAs?.isDemoDefault;
});

onMounted(async () => {
  try {
    labConfig.value = await $fetch<LabConfig>("/api/lab/config");
  } catch {
    labConfig.value = null;
  }
});

useHead({title: "Settings - walt.id"});
</script>
