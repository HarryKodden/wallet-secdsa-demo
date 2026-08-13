<template>
  <DidCreationView :didParams="{ domain: domain, path: path }" method="web">
    <div class="mb-4 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-950 ring-1 ring-sky-100">
      <p class="font-medium">Holder <code>did:web</code> (optional path)</p>
      <p class="mt-1">
        Default demos use <strong>did:jwk</strong> (no hosting). For
        <code>did:web</code>, publish the DID document at
        <code>https://&lt;domain&gt;/.well-known/did.json</code>
        (or under your path). SoftHSM still signs; only the identifier is web-hosted.
      </p>
    </div>
    <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-2">
      <label class="block font-medium text-gray-900">Domain</label>
      <div class="mt-1 sm:col-span-2 sm:mt-0">
        <input
          v-model="domain"
          class="px-2 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-xs sm:text-sm sm:leading-6"
          placeholder="example.com"
          type="text"
        />
      </div>
    </div>

    <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:py-2">
      <label class="block font-medium text-gray-900">Path</label>
      <div class="mt-1 sm:col-span-2 sm:mt-0">
        <input
          id="keyId"
          v-model="path"
          class="px-2 block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-xs sm:text-sm sm:leading-6"
          name="keyId"
          placeholder="(optional)"
          type="text"
        />
      </div>
    </div>
  </DidCreationView>
</template>

<script lang="ts" setup>
import DidCreationView from "@waltid-web-wallet/components/dids/DidCreationView.vue";

const domain = ref("");
const path = ref("");
</script>
