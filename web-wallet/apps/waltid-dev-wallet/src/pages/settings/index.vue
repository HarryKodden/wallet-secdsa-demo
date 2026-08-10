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
          Sign in here with OIDC, then show a QR code for the phone to pair.
          The mobile app unlocks with biometrics only — no password on the device.
          Paired devices and passkeys are stored on the server volume and survive restarts.
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
            <dt class="font-medium text-gray-500">WSCA account</dt>
            <dd class="sm:col-span-2 font-mono text-gray-900 break-all">{{ accountId }}</dd>
          </div>
          <div class="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
            <dt class="font-medium text-gray-500">Unlock method</dt>
            <dd class="sm:col-span-2 text-gray-900">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                6-digit PIN (set on first OIDC login)
              </span>
            </dd>
          </div>
        </dl>
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

      <section class="mt-8 rounded-2xl border border-purple-200 bg-purple-50/60 p-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">Passkeys</h2>
            <p class="mt-1 text-sm text-gray-700">
              Register a platform passkey (Touch ID, Face ID, Windows Hello) to verify
              your identity after sign-in. The passkey never leaves your device.
            </p>
          </div>
        </div>

        <div class="mt-4 flex items-center gap-3">
          <input
            v-model="newPasskeyLabel"
            class="block w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300/40"
            placeholder="Name this passkey (e.g. MacBook)"
            type="text"
          />
          <button
            class="shrink-0 rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-500 disabled:opacity-60"
            type="button"
            :disabled="registering || !newPasskeyLabel.trim()"
            @click="registerPasskey"
          >
            {{ registering ? "Registering…" : "Add passkey" }}
          </button>
        </div>

        <p v-if="passkeyError" class="mt-3 text-sm font-medium text-red-600">{{ passkeyError }}</p>
        <p v-if="passkeySuccess" class="mt-3 text-sm font-medium text-emerald-700">{{ passkeySuccess }}</p>

        <ul
          v-if="credentials.length"
          class="mt-4 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white"
        >
          <li
            v-for="cred in credentials"
            :key="cred.credentialId"
            class="flex items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <div class="min-w-0">
              <p class="font-semibold text-gray-900">{{ cred.label }}</p>
              <p class="text-gray-500">
                Registered {{ formatTime(cred.registeredAt) }}
                <span
                  v-if="cred.prfCapable"
                  class="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-900"
                >PRF</span>
              </p>
            </div>
            <button
              class="text-sm font-medium text-red-600 hover:text-red-700"
              type="button"
              @click="removePasskey(cred.credentialId)"
            >
              Remove
            </button>
          </li>
        </ul>
        <p v-else-if="!registering" class="mt-4 text-sm text-gray-500">
          No passkeys registered yet.
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

    </div>
  </CenterMain>
</template>

<script setup lang="ts">
import CenterMain from "@waltid-web-wallet/components/CenterMain.vue";
import {useCurrentWallet} from "@waltid-web-wallet/composables/accountWallet.ts";
import {useSecdsaPin} from "@waltid-web-wallet/composables/secdsaPin.ts";
import {create as webauthnCreate, supported as webauthnSupported, parseCreationOptionsFromJSON} from "@github/webauthn-json/browser-ponyfill";
import {useSecurityStore} from "@waltid-web-wallet/stores/security.ts";
import {useUserStore} from "@waltid-web-wallet/stores/user.ts";
import {storeToRefs} from "pinia";

definePageMeta({
  layout: "default-reduced-nav",
});

const config = useRuntimeConfig();
const currentWallet = useCurrentWallet();
const securityStore = useSecurityStore();
const {user} = storeToRefs(useUserStore());

const {defaultAccountId, defaultBaseUrl} = useSecdsaPin();

const accountId = computed(() => defaultAccountId());
const wscaBaseUrl = computed(() => defaultBaseUrl());

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

type PasskeyCredential = {
  credentialId: string;
  label: string;
  prfCapable: boolean;
  registeredAt: number;
  aaguid: string;
};

const labConfig = ref<LabConfig | null>(null);
const credentials = ref<PasskeyCredential[]>([]);
const registering = ref(false);
const newPasskeyLabel = ref("My passkey");
const passkeyError = ref("");
const passkeySuccess = ref("");

/** Show when a non-demo issuer AS is configured or Lab auth-code is enabled. */
const showAsConfig = computed(() => {
  const c = labConfig.value;
  if (!c) return false;
  if (c.authCodeEnabled) return true;
  return Boolean(c.issuerAs?.authorizeUrl) && !c.issuerAs?.isDemoDefault;
});

function formatTime(ms: number): string {
  try { return new Date(ms).toLocaleString(); } catch { return String(ms); }
}

async function loadCredentials() {
  try {
    const res = await $fetch<{credentials: PasskeyCredential[]}>("/wallet-api/auth/webauthn/credentials");
    credentials.value = res.credentials ?? [];
  } catch {
    credentials.value = [];
  }
}

async function registerPasskey() {
  passkeyError.value = "";
  passkeySuccess.value = "";

  if (!webauthnSupported()) {
    passkeyError.value = "Passkeys (WebAuthn) are not supported in this browser.";
    return;
  }

  registering.value = true;
  try {
    const label = newPasskeyLabel.value.trim() || "Passkey";

    const options = await $fetch("/wallet-api/auth/webauthn/register/begin", {method: "POST"});
    // parseCreationOptionsFromJSON silently drops `prf` — attach after parse.
    const createOpts = parseCreationOptionsFromJSON({publicKey: options as any});
    const prfActivationSalt = new Uint8Array(32);
    createOpts.publicKey!.extensions = {
      ...(createOpts.publicKey!.extensions ?? {}),
      prf: {eval: {first: prfActivationSalt}},
    };
    const credential = await webauthnCreate(createOpts);
    const regExt = credential.getClientExtensionResults() as {
      prf?: {enabled?: boolean; results?: unknown};
    };
    const regJSON = credential.toJSON();

    await $fetch("/wallet-api/auth/webauthn/register/finish", {
      method: "POST",
      body: {
        ...regJSON,
        label,
        clientExtensionResults: {
          ...(regJSON.clientExtensionResults ?? {}),
          prf: regExt.prf ? {enabled: regExt.prf.enabled === true || !!regExt.prf.results} : undefined,
        },
      },
    });

    passkeySuccess.value = "Passkey registered successfully.";
    newPasskeyLabel.value = "My passkey";
    await loadCredentials();
  } catch (err: any) {
    passkeyError.value = err?.data?.statusMessage || err?.message || "Registration failed.";
  } finally {
    registering.value = false;
  }
}

async function removePasskey(credentialId: string) {
  passkeyError.value = "";
  try {
    await $fetch(`/wallet-api/auth/webauthn/credentials/${encodeURIComponent(credentialId)}`, {
      method: "DELETE",
    });
    await loadCredentials();
  } catch (err: any) {
    passkeyError.value = err?.data?.statusMessage || err?.message || "Remove failed.";
  }
}


onMounted(async () => {
  try {
    labConfig.value = await $fetch<LabConfig>("/api/lab/config");
  } catch {
    labConfig.value = null;
  }
  await loadCredentials();
});

useHead({title: "Settings - walt.id"});
</script>
