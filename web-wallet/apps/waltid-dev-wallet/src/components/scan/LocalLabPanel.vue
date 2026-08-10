<template>
  <div
    v-if="labConfig?.enabled"
    class="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4"
  >
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 class="text-base font-semibold text-gray-900">Local lab</h2>
        <p class="mt-1 text-sm text-gray-600">
          Create an offer or presentation request from this stack’s configured
          issuer-api2 / verifier-api2, then continue in the normal wallet flow.
        </p>
      </div>
      <a
        class="shrink-0 text-sm font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-950"
        href="https://sandbox.dev.eduwallet.nl/"
        rel="noopener noreferrer"
        target="_blank"
      >
        eduWallet sandbox
      </a>
    </div>

    <div
      class="mt-4 grid gap-4"
      :class="
        labConfig.issuerConfigured && labConfig.verifierConfigured
          ? 'sm:grid-cols-2'
          : 'sm:grid-cols-1'
      "
    >
      <form
        v-if="labConfig.issuerConfigured"
        class="space-y-3"
        @submit.prevent="issue"
      >
        <h3 class="text-sm font-semibold text-gray-900">Get local credential</h3>
        <label class="block text-xs font-medium text-gray-700" for="lab-profile">
          Profile
        </label>
        <select
          id="lab-profile"
          v-model="profileId"
          :disabled="loadingProfiles || issuing"
          class="block w-full rounded-md border-0 px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 disabled:opacity-60"
        >
          <option disabled value="">
            {{ loadingProfiles ? "Loading profiles…" : "Select a profile" }}
          </option>
          <option
            v-for="p in preferredProfiles"
            :key="p.profileId"
            :value="p.profileId"
          >
            {{ p.name }}
          </option>
          <option
            v-for="p in otherProfiles"
            :key="p.profileId"
            :value="p.profileId"
          >
            {{ p.name }}
          </option>
        </select>

        <fieldset class="space-y-1">
          <legend class="text-xs font-medium text-gray-700">Grant</legend>
          <label class="flex items-center gap-2 text-sm text-gray-800">
            <input
              v-model="authMethod"
              class="text-emerald-600 focus:ring-emerald-600"
              type="radio"
              value="PRE_AUTHORIZED"
            />
            Pre-authorized
          </label>
          <label
            class="flex items-center gap-2 text-sm"
            :class="labConfig?.authCodeEnabled ? 'text-gray-800' : 'text-gray-400'"
          >
            <input
              v-model="authMethod"
              :disabled="!labConfig?.authCodeEnabled"
              class="text-emerald-600 focus:ring-emerald-600"
              type="radio"
              value="AUTHORIZED"
            />
            Authorization code
          </label>
        </fieldset>

        <p class="text-xs text-gray-500">
          <template v-if="labConfig?.authCodeEnabled">
            Auth-code uses issuer IdP
            <span class="font-mono break-all">{{ asHost }}</span>
            (client
            <span class="font-mono">{{ labConfig.issuerAs.clientId || "—" }}</span
            >) and wallet
            <span class="font-mono">{{ labConfig.oid4vci.clientId }}</span>.
          </template>
          <template v-else>
            Pre-authorized works offline. To enable authorization-code, set
            <span class="font-mono">ISSUER_AS_AUTHORIZE_URL</span>,
            <span class="font-mono">ISSUER_AS_TOKEN_URL</span>,
            <span class="font-mono">ISSUER_AS_CLIENT_ID</span> (+ secret) and
            <span class="font-mono">LAB_ENABLE_AUTH_CODE=true</span> in
            <span class="font-mono">.env</span>, then recreate issuer-api2 +
            web-wallet. Or use the
            <a
              class="font-medium text-emerald-800 underline"
              href="https://sandbox.dev.eduwallet.nl/"
              rel="noopener noreferrer"
              target="_blank"
              >eduWallet sandbox</a
            >.
          </template>
        </p>

        <button
          :disabled="!profileId || issuing"
          class="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          type="submit"
        >
          {{ issuing ? "Creating offer…" : "Get credential" }}
        </button>
      </form>

      <form
        v-if="labConfig.verifierConfigured"
        class="space-y-3"
        @submit.prevent="verify"
      >
        <h3 class="text-sm font-semibold text-gray-900">Present to local verifier</h3>
        <label class="block text-xs font-medium text-gray-700" for="lab-credential">
          Credential in this wallet
        </label>
        <select
          id="lab-credential"
          v-model="selectedCredentialId"
          :disabled="loadingCredentials || verifying || !walletCredentials.length"
          class="block w-full rounded-md border-0 px-3 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 disabled:opacity-60"
        >
          <option disabled value="">
            {{
              loadingCredentials
                ? "Loading credentials…"
                : walletCredentials.length
                  ? "Select a credential"
                  : "No credentials in this wallet yet"
            }}
          </option>
          <option
            v-for="c in walletCredentials"
            :key="c.id"
            :value="c.id"
          >
            {{ c.label }}
          </option>
        </select>
        <p class="text-xs text-gray-500">
          Builds a DCQL request that matches the selected credential, then starts
          OpenID4VP against verifier-api2.
        </p>
        <button
          :disabled="!selectedCredentialId || verifying"
          class="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          type="submit"
        >
          {{ verifying ? "Creating request…" : "Present to verifier" }}
        </button>
      </form>
    </div>

    <p v-if="error" class="mt-3 text-sm font-medium text-red-600">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { useCurrentWallet } from "@waltid-web-wallet/composables/accountWallet.ts";
import {
  fetchNormalizedCredentials,
  type WalletCredential,
} from "@waltid-web-wallet/composables/credential.ts";

const emit = defineEmits<{ request: [string] }>();

type LabProfile = {
  profileId: string;
  name: string;
  credentialConfigurationId: string;
};

type WalletOption = {
  id: string;
  label: string;
  format: string;
  typeValues?: string[][];
  vctValues?: string[];
  doctypeValue?: string;
};

type LabConfig = {
  enabled: boolean;
  issuerConfigured: boolean;
  verifierConfigured: boolean;
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

const PREFERRED_PROFILE_IDS = [
  "openBadgeCredential",
  "bankId",
  "kycCredential",
];

const currentWallet = useCurrentWallet();
const profiles = ref<LabProfile[]>([]);
const walletCredentials = ref<WalletOption[]>([]);
const labConfig = ref<LabConfig | null>(null);
const profileId = ref("openBadgeCredential");
const selectedCredentialId = ref("");
const authMethod = ref<"PRE_AUTHORIZED" | "AUTHORIZED">("PRE_AUTHORIZED");
const loadingProfiles = ref(true);
const loadingCredentials = ref(true);
const issuing = ref(false);
const verifying = ref(false);
const error = ref("");

const preferredProfiles = computed(() =>
  profiles.value.filter((p) => PREFERRED_PROFILE_IDS.includes(p.profileId)),
);
const otherProfiles = computed(() =>
  profiles.value.filter((p) => !PREFERRED_PROFILE_IDS.includes(p.profileId)),
);
const asHost = computed(() => {
  const url = labConfig.value?.issuerAs?.authorizeUrl;
  if (!url) return "—";
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
});

onMounted(async () => {
  await loadLabConfig();
  const cfg = labConfig.value;
  if (!cfg?.enabled) {
    loadingProfiles.value = false;
    loadingCredentials.value = false;
    return;
  }
  const tasks: Promise<void>[] = [];
  if (cfg.issuerConfigured) tasks.push(loadProfiles());
  else loadingProfiles.value = false;
  if (cfg.verifierConfigured) tasks.push(loadWalletCredentials());
  else loadingCredentials.value = false;
  await Promise.all(tasks);
});

async function loadLabConfig() {
  try {
    labConfig.value = await $fetch<LabConfig>("/api/lab/config");
    if (!labConfig.value.authCodeEnabled && authMethod.value === "AUTHORIZED") {
      authMethod.value = "PRE_AUTHORIZED";
    }
  } catch {
    labConfig.value = null;
  }
}

async function loadProfiles() {
  loadingProfiles.value = true;
  try {
    const profileList = await $fetch<LabProfile[]>("/api/lab/profiles");
    profiles.value = profileList.filter((p) => p.profileId);
    if (!profiles.value.some((p) => p.profileId === profileId.value)) {
      profileId.value = profiles.value[0]?.profileId || "";
    }
  } catch (e: unknown) {
    error.value = extractError(
      e,
      "Could not load issuer profiles. Is issuer-api2 running?",
    );
  } finally {
    loadingProfiles.value = false;
  }
}

async function loadWalletCredentials() {
  loadingCredentials.value = true;
  try {
    const walletId = currentWallet.value;
    if (!walletId) {
      walletCredentials.value = [];
      selectedCredentialId.value = "";
      return;
    }
    const list = await fetchNormalizedCredentials(walletId);
    walletCredentials.value = list
      .map(toWalletOption)
      .filter((c): c is WalletOption => c != null);
    if (!walletCredentials.value.some((c) => c.id === selectedCredentialId.value)) {
      selectedCredentialId.value = walletCredentials.value[0]?.id || "";
    }
  } catch (e: unknown) {
    error.value = extractError(e, "Could not load wallet credentials");
  } finally {
    loadingCredentials.value = false;
  }
}

function toWalletOption(cred: WalletCredential): WalletOption | null {
  const format = normalizeFormat(cred.format);
  const doc = cred.parsedDocument || {};
  const label = credentialLabel(cred, format);

  if (format === "mso_mdoc") {
    const doctypeValue =
      String(doc.docType || doc.doctype || "").trim() || "org.iso.18013.5.1.mDL";
    return { id: cred.id, label, format, doctypeValue };
  }

  if (format === "dc+sd-jwt" || format === "vc+sd-jwt") {
    const vct = String(doc.vct || "").trim();
    if (!vct) return null;
    return { id: cred.id, label, format, vctValues: [vct] };
  }

  const types = Array.isArray(doc.type)
    ? doc.type.map((t) => String(t)).filter(Boolean)
    : [];
  if (!types.length) {
    types.push("VerifiableCredential");
  }
  return {
    id: cred.id,
    label,
    format: format || "jwt_vc_json",
    typeValues: [types],
  };
}

function normalizeFormat(format?: string): string {
  const f = String(format || "jwt_vc_json").trim();
  if (f === "mso_mdoc" || f.includes("mdoc")) return "mso_mdoc";
  if (f === "vc+sd-jwt") return "vc+sd-jwt";
  if (f.includes("sd-jwt") || f === "dc+sd-jwt") return "dc+sd-jwt";
  if (f.includes("jwt_vc")) return "jwt_vc_json";
  return f || "jwt_vc_json";
}

function credentialLabel(cred: WalletCredential, format: string): string {
  const doc = cred.parsedDocument || {};
  const types = Array.isArray(doc.type) ? doc.type.map(String) : [];
  const specific =
    types.filter((t) => t !== "VerifiableCredential").slice(-1)[0] ||
    doc.vct ||
    doc.docType ||
    format;
  const name = String(doc.name || specific || "Credential");
  const shortId = String(cred.id).slice(0, 8);
  return `${name} · ${shortId}`;
}

async function issue() {
  error.value = "";
  issuing.value = true;
  try {
    const result = await $fetch<{ credentialOffer?: string }>("/api/lab/issue", {
      method: "POST",
      body: {
        profileId: profileId.value,
        authMethod: authMethod.value,
      },
    });
    const offer = result?.credentialOffer;
    if (!offer) {
      throw new Error("Issuer did not return a credential offer URL");
    }
    emit("request", offer);
    // Refresh present list after a successful receive happens elsewhere;
    // here we only start the flow — refresh when panel remounts / user returns.
  } catch (e: unknown) {
    error.value = extractError(e, "Failed to create credential offer");
  } finally {
    issuing.value = false;
  }
}

async function verify() {
  error.value = "";
  verifying.value = true;
  try {
    const selected = walletCredentials.value.find(
      (c) => c.id === selectedCredentialId.value,
    );
    if (!selected) {
      throw new Error("Select a credential from your wallet");
    }
    const walletId = currentWallet.value;
    const returnBase =
      typeof window !== "undefined"
        ? `${window.location.origin}/wallet/${walletId}`
        : `/wallet/${walletId}`;
    const result = await $fetch<{ requestUrl?: string }>("/api/lab/verify", {
      method: "POST",
      body: {
        format: selected.format,
        typeValues: selected.typeValues,
        vctValues: selected.vctValues,
        doctypeValue: selected.doctypeValue,
        queryId: `wallet_${selected.id}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64),
        successRedirectUri: `${returnBase}?presented=1`,
        errorRedirectUri: `${returnBase}?presented=0`,
      },
    });
    const requestUrl = result?.requestUrl;
    if (!requestUrl) {
      throw new Error("Verifier did not return a presentation request URL");
    }
    emit("request", requestUrl);
  } catch (e: unknown) {
    error.value = extractError(e, "Failed to create presentation request");
  } finally {
    verifying.value = false;
  }
}

function extractError(e: unknown, fallback: string): string {
  const err = e as {
    data?: { statusMessage?: string; message?: string };
    statusMessage?: string;
    message?: string;
  };
  return (
    err?.data?.statusMessage ||
    err?.data?.message ||
    err?.statusMessage ||
    err?.message ||
    fallback
  );
}
</script>
