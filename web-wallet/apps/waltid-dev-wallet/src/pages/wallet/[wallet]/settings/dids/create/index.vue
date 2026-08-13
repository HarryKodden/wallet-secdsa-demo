<template>
  <CenterMain>
    <p class="mt-2 mb-3 text-sm text-gray-600">
      This SoftHSM demo only generates <strong>secp256r1</strong> (P-256) keys.
      Prefer <strong>did:jwk</strong> or <strong>did:web</strong> for holder DIDs (DIIP).
    </p>
    <ol
      class="divide-y divide-gray-100 list-decimal border rounded-2xl mt-2 px-3"
      role="list"
    >
      <li
        v-for="method in methods"
        :key="method.id"
        class="flex items-center justify-between gap-x-6 py-4"
      >
        <div class="min-w-0">
          <div class="flex items-start gap-x-3">
            <p class="text-base font-semibold leading-6 text-gray-900">
              {{ method.id.toUpperCase() }} (did:{{ method.id }}):
              <span class="text-base font-normal">
                {{
                  method.params.length == 0
                    ? "no parameters needed"
                    : "Define (" +
                      method.params.length +
                      "): " +
                      method.params.join(", ")
                }}</span
              >
            </p>
          </div>
        </div>
        <div class="flex flex-none items-center gap-x-4">
          <NuxtLink
            :to="'create/' + method.id"
            class="w-32 text-center rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:block"
          >
            Create did:{{ method.id }}
          </NuxtLink>
        </div>
      </li>
    </ol>
  </CenterMain>
</template>

<script lang="ts" setup>
import CenterMain from "@waltid-web-wallet/components/CenterMain.vue";

const methods = [
  { id: "key", params: ["useJwkJcsPub"] },
  { id: "jwk", params: [] as string[] },
  { id: "web", params: ["domain", "path"] },
];

useHead({
  title: "Create DID - walt.id",
});
</script>

<style scoped></style>
