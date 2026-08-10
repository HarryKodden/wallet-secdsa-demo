<template>
  <div class="w-full max-w-sm">
    <div class="flex justify-end">
      <button
        class="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        type="button"
        :disabled="busy"
        @click="cancel"
      >
        <span class="sr-only">Close</span>
        <XMarkIcon aria-hidden="true" class="h-6 w-6" />
      </button>
    </div>
    <form class="space-y-5" @submit.prevent="submit">
      <div>
        <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
          {{ title }}
        </h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          <template v-if="mode === 'setup'">
            Choose a 6-digit PIN to initialise your SECDSA SoftHSM account
            <template v-if="accountHint">
              (<code class="break-all">{{ accountHint }}</code>).
            </template>
            This PIN is locked to the account — web and mobile must use the same PIN.
          </template>
          <template v-else>
            Enter the SoftHSM PIN already locked to this account
            <template v-if="accountHint">
              (<code class="break-all">{{ accountHint }}</code>).
            </template>
            You cannot choose a new PIN once the account is activated.
          </template>
        </p>
      </div>

      <div>
        <label
          class="block text-sm font-medium leading-6 text-gray-900 dark:text-white"
          for="secdsa-pin"
        >
          {{ mode === "setup" ? "New PIN" : "PIN" }}
        </label>
        <div class="mt-2">
          <input
            id="secdsa-pin"
            v-model="pin"
            autocomplete="one-time-code"
            autofocus
            class="block w-full rounded-md border-0 py-1.5 px-2 shadow-sm ring-1 ring-inset ring-gray-300 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 bg-white dark:bg-gray-700 tracking-[0.35em]"
            inputmode="numeric"
            maxlength="6"
            minlength="6"
            name="secdsa-pin"
            pattern="[0-9]{6}"
            placeholder="••••••"
            required
            type="password"
            :disabled="busy"
          />
        </div>
      </div>

      <div v-if="mode === 'setup'">
        <label
          class="block text-sm font-medium leading-6 text-gray-900 dark:text-white"
          for="secdsa-pin-confirm"
        >
          Confirm PIN
        </label>
        <div class="mt-2">
          <input
            id="secdsa-pin-confirm"
            v-model="pinConfirm"
            autocomplete="one-time-code"
            class="block w-full rounded-md border-0 py-1.5 px-2 shadow-sm ring-1 ring-inset ring-gray-300 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 bg-white dark:bg-gray-700 tracking-[0.35em]"
            inputmode="numeric"
            maxlength="6"
            minlength="6"
            name="secdsa-pin-confirm"
            pattern="[0-9]{6}"
            placeholder="••••••"
            required
            type="password"
            :disabled="busy"
          />
        </div>
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>

      <div class="flex gap-2">
        <button
          class="inline-flex flex-1 justify-center rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 disabled:opacity-60"
          type="button"
          :disabled="busy"
          @click="cancel"
        >
          Cancel
        </button>
        <button
          class="inline-flex flex-1 justify-center rounded-md bg-blue-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60"
          type="submit"
          :disabled="busy"
        >
          {{ busy ? busyLabel : submitLabel }}
        </button>
      </div>
    </form>
  </div>
</template>

<script lang="ts" setup>
import {computed, ref} from "vue";
import {XMarkIcon} from "@heroicons/vue/24/outline";

const props = defineProps<{
  title?: string;
  /** unlock = existing account; setup = first-time initialise (confirm PIN) */
  mode?: "unlock" | "setup";
  accountHint?: string;
  /** Optional async unlock/activate. Modal stays open on failure so the user can retry. */
  unlock?: (pin: string) => Promise<void>;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}>();

const mode = computed(() => props.mode ?? "unlock");
const title = computed(
  () =>
    props.title ??
    (mode.value === "setup" ? "Set your SECDSA PIN" : "Enter SECDSA PIN"),
);
const submitLabel = computed(() => (mode.value === "setup" ? "Initialise" : "Unlock"));
const busyLabel = computed(() => (mode.value === "setup" ? "Initialising…" : "Unlocking…"));

const pin = ref("");
const pinConfirm = ref("");
const error = ref("");
const busy = ref(false);

function validatePin(value: string): string | null {
  if (!/^\d{6}$/.test(value)) {
    return "PIN must be exactly 6 digits";
  }
  if (mode.value === "setup" && value !== pinConfirm.value.trim()) {
    return "PINs do not match";
  }
  return null;
}

async function submit() {
  const value = pin.value.trim();
  const validationError = validatePin(value);
  if (validationError) {
    error.value = validationError;
    return;
  }
  error.value = "";

  if (props.unlock) {
    busy.value = true;
    try {
      await props.unlock(value);
      props.onSubmit(value);
    } catch (e: any) {
      const detail = e?.data?.message || e?.data || e?.statusMessage || e?.message || e;
      error.value =
        typeof detail === "string"
          ? detail
          : mode.value === "setup"
            ? "Initialisation failed — try again"
            : "Wrong PIN or unlock failed — try again";
      pin.value = "";
      pinConfirm.value = "";
    } finally {
      busy.value = false;
    }
    return;
  }

  props.onSubmit(value);
}

function cancel() {
  if (busy.value) return;
  props.onCancel();
}
</script>
