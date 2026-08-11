<template>
  <CenterMain>
    <div class="max-w-2xl">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-gray-900">Mobile devices</h1>
          <p class="mt-2 text-sm text-gray-600">
            Onboard on the web with OIDC, then scan this QR from the mobile wallet.
            The phone unlocks with biometrics — no password on the device.
          </p>
        </div>
        <NuxtLink
          class="shrink-0 text-sm font-medium text-blue-600 hover:text-blue-700"
          to="/"
        >
          ← Home
        </NuxtLink>
      </div>

      <section class="mt-8 rounded-2xl border border-gray-200 bg-white p-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-gray-900">Connect a device</h2>
          <button
            v-if="!needsReauth"
            class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-60"
            type="button"
            :disabled="creating"
            @click="createPairing"
          >
            {{ creating ? "Creating…" : pairing ? "Refresh QR" : "Show QR code" }}
          </button>
        </div>

        <!-- Passkey re-assertion required before pairing -->
        <div v-if="needsReauth" class="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4">
          <p class="text-sm font-medium text-purple-900">
            Verify your passkey to continue
          </p>
          <p class="mt-1 text-sm text-purple-700">
            A passkey check is required before pairing a new device.
          </p>
          <button
            class="mt-3 flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-500 disabled:opacity-60"
            type="button"
            :disabled="asserting"
            @click="reauth"
          >
            <span v-if="asserting" class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <span>{{ asserting ? "Verifying…" : "Verify with passkey" }}</span>
          </button>
          <p v-if="reauthError" class="mt-2 text-sm text-red-600">{{ reauthError }}</p>
        </div>

        <p v-if="error && !needsReauth" class="mt-3 text-sm font-medium text-red-600">{{ error }}</p>

        <div v-if="pairing" class="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div class="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <qrcode-vue :value="pairing.deepLink" :size="220" level="M" />
          </div>
          <div class="min-w-0 flex-1 text-sm text-gray-700">
            <p class="font-medium text-gray-900">Scan with the SECDSA Wallet app</p>
            <p class="mt-2">
              Status:
              <span
                class="rounded-full px-2 py-0.5 text-xs font-semibold"
                :class="statusClass"
              >
                {{ statusLabel }}
              </span>
            </p>
            <p class="mt-2 text-gray-600">
              Expires in {{ remainingLabel }}. Code is single-use.
            </p>
            <p class="mt-3 break-all font-mono text-xs text-gray-500">
              {{ pairing.deepLink }}
            </p>
            <p
              v-if="pairing.webWalletBaseUrl || pairing.walletApi2BaseUrl"
              class="mt-3 space-y-1 text-xs text-gray-600"
            >
              <span class="block font-medium text-gray-800">Advertised to the phone</span>
              <span v-if="pairing.webWalletBaseUrl" class="block break-all">
                Web: <code class="rounded bg-gray-100 px-1">{{ pairing.webWalletBaseUrl }}</code>
              </span>
              <span v-if="pairing.walletApi2BaseUrl" class="block break-all">
                API: <code class="rounded bg-gray-100 px-1">{{ pairing.walletApi2BaseUrl }}</code>
              </span>
            </p>
            <p class="mt-4 text-xs text-gray-500">
              Local emulator: <code class="rounded bg-gray-100 px-1">adb reverse tcp:7115 tcp:7115</code>
              and <code class="rounded bg-gray-100 px-1">adb reverse tcp:7006 tcp:7006</code>.
              Public TLS deploy: set
              <code class="rounded bg-gray-100 px-1">NUXT_PUBLIC_OIDC_PUBLIC_BASE_URL</code>
              and
              <code class="rounded bg-gray-100 px-1">NUXT_PUBLIC_WALLET_API2_BASE_URL</code>
              (or <code class="rounded bg-gray-100 px-1">WALLET2_PUBLIC_BASE_URL</code>).
            </p>
          </div>
        </div>
      </section>

      <section class="mt-8">
        <h2 class="text-lg font-semibold text-gray-900">Registered devices</h2>
        <p class="mt-1 text-sm text-gray-600">
          Devices paired to your account. Pairing codes are single-use and expire in 5 minutes;
          the device registration persists across server restarts.
        </p>
        <ul
          v-if="devices.length"
          class="mt-3 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white"
        >
          <li
            v-for="d in devices"
            :key="d.id"
            class="flex items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <div class="min-w-0">
              <p class="font-semibold text-gray-900">{{ d.label }}</p>
              <p class="text-gray-500">
                {{ d.platform }} · paired {{ formatTime(d.pairedAt) }}
              </p>
            </div>
            <button
              class="text-sm font-medium text-red-600 hover:text-red-700"
              type="button"
              @click="revoke(d.id)"
            >
              Revoke
            </button>
          </li>
        </ul>
        <p v-else class="mt-3 text-sm text-gray-500">No devices paired yet.</p>
      </section>
    </div>
  </CenterMain>
</template>

<script lang="ts" setup>
import CenterMain from "@waltid-web-wallet/components/CenterMain.vue";
import QrcodeVue from "qrcode.vue";
import {get as webauthnGet, supported as webauthnSupported, parseRequestOptionsFromJSON} from "@github/webauthn-json/browser-ponyfill";
import {getOrCreateAppSalt, derivePrfKey} from "@waltid-web-wallet/composables/webauthnPrf.ts";
import {useSecurityStore} from "@waltid-web-wallet/stores/security.ts";
import {useUserStore} from "@waltid-web-wallet/stores/user.ts";
import {storeToRefs} from "pinia";

definePageMeta({
    layout: "default-reduced-nav",
});

type PairingCreated = {
    code: string;
    deepLink: string;
    expiresAt: number;
    ttlMs: number;
    webWalletBaseUrl?: string;
    walletApi2BaseUrl?: string;
};

type PairingStatus = {
    code: string;
    status: "pending" | "claimed" | "expired";
    expiresAt: number;
    deviceLabel?: string;
};

type Device = {
    id: string;
    label: string;
    platform: string;
    pairedAt: number;
};

const pairing = ref<PairingCreated | null>(null);
const status = ref<PairingStatus | null>(null);
const devices = ref<Device[]>([]);
const creating = ref(false);
const error = ref("");
const now = ref(Date.now());

const needsReauth = ref(false);
const asserting = ref(false);
const reauthError = ref("");

const {user} = storeToRefs(useUserStore());

const remainingLabel = computed(() => {
    if (!pairing.value) return "";
    const left = Math.max(0, pairing.value.expiresAt - now.value);
    const s = Math.ceil(left / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}m ${r}s` : `${r}s`;
});

const statusLabel = computed(() => {
    const s = status.value?.status || "pending";
    if (s === "claimed") return "Connected";
    if (s === "expired") return "Expired";
    return "Waiting for scan";
});

const statusClass = computed(() => {
    const s = status.value?.status || "pending";
    if (s === "claimed") return "bg-emerald-100 text-emerald-900";
    if (s === "expired") return "bg-red-100 text-red-900";
    return "bg-amber-100 text-amber-900";
});

function formatTime(ms: number): string {
    try {
        return new Date(ms).toLocaleString();
    } catch {
        return String(ms);
    }
}

async function loadDevices() {
    try {
        const res = await $fetch<{devices: Device[]}>("/wallet-api/auth/devices");
        devices.value = res.devices || [];
    } catch {
        devices.value = [];
    }
}

async function createPairing() {
    creating.value = true;
    error.value = "";
    needsReauth.value = false;
    try {
        pairing.value = await $fetch<PairingCreated>("/wallet-api/auth/pair/create", {
            method: "POST",
        });
        status.value = {
            code: pairing.value.code,
            status: "pending",
            expiresAt: pairing.value.expiresAt,
        };
    } catch (e: any) {
        if (e?.status === 403 || e?.data?.statusCode === 403) {
            needsReauth.value = true;
            pairing.value = null;
        } else {
            error.value = e?.data?.statusMessage || e?.message || "Could not create pairing code";
            pairing.value = null;
        }
    } finally {
        creating.value = false;
    }
}

/** Re-assertion: run WebAuthn get(), stamp the cookie, then retry pairing automatically. */
async function reauth() {
    reauthError.value = "";
    asserting.value = true;

    if (!webauthnSupported()) {
        reauthError.value = "Passkeys are not supported in this browser.";
        asserting.value = false;
        return;
    }

    try {
        const accountId: string = user.value?.id || "";

        const beginRes = await $fetch<{noCredentials?: boolean; resolvedAccountId?: string; extensions?: unknown; [k: string]: unknown}>(
            "/wallet-api/auth/webauthn/authenticate/begin",
            {method: "POST"},  // no body — server resolves accountId from auth.token cookie
        );

        if (beginRes.noCredentials) {
            needsReauth.value = false;
            asserting.value = false;
            await createPairing();
            return;
        }

        // Use server-resolved accountId for PRF salt (avoids stale user store)
        const resolvedAccountId = beginRes.resolvedAccountId || accountId;
        const appSalt = await getOrCreateAppSalt(resolvedAccountId);

        // parseRequestOptionsFromJSON silently drops `prf` — attach after parse.
        const getOpts = parseRequestOptionsFromJSON({publicKey: beginRes as any});
        getOpts.publicKey!.extensions = {
            ...(getOpts.publicKey!.extensions ?? {}),
            prf: {eval: {first: appSalt}},
        };

        const assertion = await webauthnGet(getOpts);

        // Derive PRF key if available (keep in memory).
        const authExt = assertion.getClientExtensionResults() as {
            prf?: {results?: {first?: ArrayBuffer}};
        };
        const prfFirst = authExt.prf?.results?.first;
        const prfBytes: Uint8Array | null = prfFirst ? new Uint8Array(prfFirst) : null;
        if (prfBytes) {
            try {
                const aesKey = await derivePrfKey(prfBytes, appSalt);
                useSecurityStore().setKey(aesKey, resolvedAccountId);
            } catch { /* non-fatal */ }
        }

        // Strip PRF bytes before sending to server (toJSON already omits PRF).
        const assertionJSON = assertion.toJSON();
        const assertionForServer = {
            ...assertionJSON,
            clientExtensionResults: {...(assertionJSON.clientExtensionResults ?? {}), prf: undefined},
        };

        await $fetch("/wallet-api/auth/webauthn/authenticate/finish", {
            method: "POST",
            body: assertionForServer,
        });

        needsReauth.value = false;
        asserting.value = false;
        await createPairing();
    } catch (err: any) {
        reauthError.value = err?.data?.statusMessage || err?.message || "Verification failed. Please try again.";
        asserting.value = false;
    }
}

async function revoke(deviceId: string) {
    try {
        await $fetch(`/wallet-api/auth/devices/${encodeURIComponent(deviceId)}`, {
            method: "DELETE",
        });
        await loadDevices();
    } catch (e: any) {
        error.value = e?.data?.statusMessage || e?.message || "Revoke failed";
    }
}

let tick: ReturnType<typeof setInterval> | undefined;
let poll: ReturnType<typeof setInterval> | undefined;

onMounted(async () => {
    await loadDevices();
    tick = setInterval(() => {
        now.value = Date.now();
    }, 1000);
    poll = setInterval(async () => {
        if (!pairing.value || status.value?.status === "claimed") return;
        try {
            status.value = await $fetch<PairingStatus>(
                `/wallet-api/auth/pair/${encodeURIComponent(pairing.value.code)}`,
            );
            if (status.value.status === "claimed") {
                await loadDevices();
            }
        } catch {
            // ignore poll errors
        }
    }, 2000);
});

onUnmounted(() => {
    if (tick) clearInterval(tick);
    if (poll) clearInterval(poll);
});
</script>
