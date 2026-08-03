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
          Enter the PIN for your SoftHSM account. For the lab account
          <code>citizen-42</code> the default is <code>424242</code> — a new PIN
          only works after activating a fresh account in the lab UI.
          Base URL from Docker must be
          <code>http://host.docker.internal:18080</code> (not localhost).
        </p>
      </div>

      <div>
        <label
          class="block text-sm font-medium leading-6 text-gray-900 dark:text-white"
          for="secdsa-pin"
        >
          PIN
        </label>
        <div class="mt-2">
          <input
            id="secdsa-pin"
            v-model="pin"
            autocomplete="current-password"
            autofocus
            class="block w-full rounded-md border-0 py-1.5 px-2 shadow-sm ring-1 ring-inset ring-gray-300 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 bg-white dark:bg-gray-700"
            inputmode="numeric"
            minlength="4"
            name="secdsa-pin"
            required
            type="password"
            :disabled="busy"
          />
        </div>
        <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
      </div>

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
          {{ busy ? "Unlocking…" : "Unlock" }}
        </button>
      </div>
    </form>
  </div>
</template>

<script lang="ts" setup>
import {ref} from "vue";
import {XMarkIcon} from "@heroicons/vue/24/outline";

const props = defineProps<{
  title?: string;
  /** Optional async unlock. If provided, modal stays open on failure so the user can retry. */
  unlock?: (pin: string) => Promise<void>;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}>();

const title = props.title ?? "Enter SECDSA PIN";
const pin = ref("");
const error = ref("");
const busy = ref(false);

async function submit() {
  const value = pin.value.trim();
  if (value.length < 4) {
    error.value = "PIN must be at least 4 characters";
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
          : "Wrong PIN or unlock failed — try again";
      pin.value = "";
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
