<template>
  <CenterMain>
    <div class="max-w-3xl">
      <p class="mb-4 text-sm">
        <NuxtLink class="text-blue-600 underline" to="/settings">← Settings</NuxtLink>
      </p>
      <h1 class="text-2xl font-semibold text-gray-900">Connections</h1>
      <p class="mt-2 text-sm text-gray-600">
        OID4VCI wallet client profiles used when accepting credential offers.
        Lab and sandbox are presets; add a custom profile for other issuers.
        Values are stored in this browser only (not secrets).
      </p>

      <section class="mt-8">
        <h2 class="text-lg font-semibold text-gray-900">Active profile</h2>
        <ul class="mt-3 space-y-2">
          <li
            v-for="item in state.items"
            :key="item.id"
            class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3"
            :class="
              item.id === state.activeId
                ? 'border-blue-300 bg-blue-50'
                : 'border-gray-200 bg-white'
            "
          >
            <button
              type="button"
              class="min-w-0 flex-1 text-left"
              @click="selectActive(item.id)"
            >
              <p class="font-semibold text-gray-900">
                {{ item.label }}
                <span
                  v-if="item.id === state.activeId"
                  class="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white"
                >
                  Active
                </span>
              </p>
              <p class="mt-0.5 truncate font-mono text-xs text-gray-600">
                {{ item.clientId }}
              </p>
            </button>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                @click="editItem(item)"
              >
                Edit
              </button>
              <button
                v-if="item.preset === 'custom'"
                type="button"
                class="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                @click="removeCustom(item.id)"
              >
                Delete
              </button>
            </div>
          </li>
        </ul>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            @click="addCustom"
          >
            Add custom
          </button>
          <button
            type="button"
            class="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            @click="resetPresets"
          >
            Reset Lab / sandbox from env
          </button>
        </div>
      </section>

      <section v-if="draft" class="mt-8 rounded-2xl border border-gray-200 bg-white p-4">
        <h2 class="text-lg font-semibold text-gray-900">
          {{ draft.preset === "custom" && !state.items.some((i) => i.id === draft.id) ? "New connection" : "Edit connection" }}
        </h2>
        <form class="mt-4 space-y-4" @submit.prevent="saveDraft">
          <label class="block text-sm">
            <span class="font-medium text-gray-700">Label</span>
            <input
              v-model="draft.label"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-sans text-gray-900"
              required
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium text-gray-700">Issuer base URL (optional hint)</span>
            <input
              v-model="draft.issuerBaseUrl"
              type="url"
              placeholder="https://issuer.example.com"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900"
            />
            <span class="mt-1 block text-xs text-gray-500">
              Offers still carry <code>credential_issuer</code>. This is a note for operators.
            </span>
          </label>
          <label class="block text-sm">
            <span class="font-medium text-gray-700">OID4VCI client_id</span>
            <input
              v-model="draft.clientId"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900"
              required
            />
          </label>
          <label class="block text-sm">
            <span class="font-medium text-gray-700">OID4VCI redirect_uri</span>
            <input
              v-model="draft.redirectUri"
              type="url"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-900"
              required
            />
          </label>
          <label class="flex items-start gap-2 text-sm text-gray-800">
            <input v-model="draft.forcePar" type="checkbox" class="mt-1" />
            <span>
              Prefer PAR (pushed authorization requests)
              <span class="block text-xs text-gray-500">
                Stored for tooling; wallet-api2 already uses PAR when the AS requires it.
              </span>
            </span>
          </label>
          <label class="flex items-start gap-2 text-sm text-gray-800">
            <input v-model="draft.useDpop" type="checkbox" class="mt-1" />
            <span>
              Use DPoP
              <span class="block text-xs text-gray-500">
                Not wired yet — flag is saved for a later protocol step.
              </span>
            </span>
          </label>
          <div class="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              class="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Save
            </button>
            <button
              type="button"
              class="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              @click="draft = null"
            >
              Cancel
            </button>
          </div>
        </form>
      </section>

      <p v-if="notice" class="mt-4 text-sm text-emerald-800">{{ notice }}</p>
    </div>
  </CenterMain>
</template>

<script setup lang="ts">
import CenterMain from "@waltid-web-wallet/components/CenterMain.vue";
import {
  buildCustomConnection,
  buildLabConnection,
  buildSandboxConnection,
  defaultConnectionsState,
  envDefaultsFromRuntime,
  loadConnectionsState,
  saveConnectionsState,
  type Oid4vciConnection,
  type Oid4vciConnectionsState,
} from "@waltid-web-wallet/composables/oid4vciConnections.ts";

definePageMeta({
  layout: "default-reduced-nav",
});

useHead({title: "Connections - walt.id"});

const runtimeConfig = useRuntimeConfig();
const defaults = computed(() => envDefaultsFromRuntime(runtimeConfig));

const state = ref<Oid4vciConnectionsState>(defaultConnectionsState(defaults.value));
const draft = ref<Oid4vciConnection | null>(null);
const notice = ref("");

function refresh() {
  state.value = loadConnectionsState(defaults.value);
}

onMounted(() => {
  refresh();
});

function persist(next: Oid4vciConnectionsState) {
  saveConnectionsState(next);
  state.value = next;
  notice.value = "Saved in this browser.";
}

function selectActive(id: string) {
  persist({...state.value, activeId: id});
}

function editItem(item: Oid4vciConnection) {
  draft.value = {...item};
  notice.value = "";
}

function addCustom() {
  draft.value = buildCustomConnection(defaults.value);
  notice.value = "";
}

function saveDraft() {
  if (!draft.value) return;
  const nextItem = {...draft.value, label: draft.value.label.trim() || "Custom"};
  if (!nextItem.clientId.trim() || !nextItem.redirectUri.trim()) return;
  const items = [...state.value.items];
  const idx = items.findIndex((i) => i.id === nextItem.id);
  if (idx >= 0) items[idx] = nextItem;
  else items.push(nextItem);
  persist({
    version: 1,
    activeId: state.value.activeId,
    items,
  });
  draft.value = null;
}

function removeCustom(id: string) {
  const items = state.value.items.filter((i) => i.id !== id);
  const activeId =
    state.value.activeId === id ? (items[0]?.id ?? "preset-lab") : state.value.activeId;
  persist({version: 1, activeId, items});
  if (draft.value?.id === id) draft.value = null;
}

function resetPresets() {
  const lab = buildLabConnection(defaults.value);
  const sandbox = buildSandboxConnection(defaults.value);
  const customs = state.value.items.filter((i) => i.preset === "custom");
  persist({
    version: 1,
    activeId: state.value.activeId === "preset-sandbox" ? sandbox.id : lab.id,
    items: [lab, sandbox, ...customs],
  });
  draft.value = null;
}
</script>
