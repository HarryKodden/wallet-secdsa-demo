<template>
  <div class="w-full max-w-md">
    <div class="flex justify-end">
      <button
        class="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        type="button"
        @click="cancel"
      >
        <span class="sr-only">Close</span>
        <XMarkIcon aria-hidden="true" class="h-6 w-6" />
      </button>
    </div>

    <div class="space-y-4">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          Confirm signing
        </p>
        <h3 class="mt-1 text-base font-semibold leading-6 text-gray-900 dark:text-white">
          {{ title }}
        </h3>
        <p v-if="party" class="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Party:
          <span class="font-medium text-gray-900 dark:text-white">{{ party }}</span>
        </p>
        <p v-if="detail" class="mt-2 text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
          {{ detail }}
        </p>
        <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Next you will confirm presence (passkey). SoftHSM PIN is used only to mint a short-lived
          SignGrant — not as a free-floating unlock for every operation. This demo does not claim
          certified LoA High.
        </p>
      </div>

      <div class="flex justify-end gap-2 pt-1">
        <button
          type="button"
          class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
          @click="cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          @click="confirm"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {XMarkIcon} from "@heroicons/vue/24/outline";
import useModalStore from "../../stores/useModalStore.ts";

const props = withDefaults(
  defineProps<{
    title: string;
    party?: string;
    detail?: string;
    confirmLabel?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>(),
  {
    confirmLabel: "Continue",
  },
);

const modalStore = useModalStore();

function confirm() {
  props.onConfirm?.();
  modalStore.closeModal();
}

function cancel() {
  props.onCancel?.();
  modalStore.closeModal();
}
</script>
