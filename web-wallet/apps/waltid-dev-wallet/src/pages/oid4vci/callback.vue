<template>
  <div>
    <PageHeader>
      <template v-slot:title>
        <div class="ml-3">
          <h1
            class="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:leading-9"
          >
            Completing credential issuance
          </h1>
          <p class="text-sm text-gray-600">
            Authorization code grant — finishing after issuer sign-in
          </p>
        </div>
      </template>
    </PageHeader>

    <CenterMain>
      <LoadingIndicator v-if="phase === 'working'" class="my-6 mb-12 w-full">
        {{ statusText }}
      </LoadingIndicator>

      <div
        v-else-if="phase === 'error'"
        class="rounded-md bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200"
      >
        <p class="font-semibold">Could not finish authorization_code issuance</p>
        <p class="mt-2 whitespace-pre-wrap">{{ errorMessage }}</p>
        <div class="mt-4 flex flex-wrap gap-3">
          <NuxtLink
            v-if="walletId"
            class="font-medium text-indigo-700 underline"
            :to="`/wallet/${walletId}`"
          >
            Back to wallet
          </NuxtLink>
          <NuxtLink class="font-medium text-indigo-700 underline" to="/">
            Home
          </NuxtLink>
        </div>
      </div>
    </CenterMain>
  </div>
</template>

<script lang="ts" setup>
import CenterMain from "@waltid-web-wallet/components/CenterMain.vue";
import PageHeader from "@waltid-web-wallet/components/PageHeader.vue";
import LoadingIndicator from "@waltid-web-wallet/components/loading/LoadingIndicator.vue";
import {useSecdsaPin} from "@waltid-web-wallet/composables/secdsaPin.ts";
import {
    cancelAuthCodeContinuation,
    clearAuthCodeContinuation,
    completeAuthCodeIssuance,
    resolveAuthCodeContinuation,
} from "@waltid-web-wallet/composables/oid4vciAuthCode.ts";
import {useTitle} from "@vueuse/core";

const route = useRoute();
const phase = ref<"working" | "error">("working");
const statusText = ref("Validating issuer callback…");
const errorMessage = ref("");
const walletId = ref<string | null>(null);

useTitle("OID4VCI callback - walt.id");

function fail(message: string) {
  phase.value = "error";
  errorMessage.value = message;
  clearAuthCodeContinuation();
}

onMounted(async () => {
  const q = route.query;
  const error = typeof q.error === "string" ? q.error : null;
  const errorDescription =
    typeof q.error_description === "string" ? q.error_description : null;
  if (error) {
    // User denied / cancelled at the AS — clear pending session + show reason.
    if (error === "access_denied") {
      cancelAuthCodeContinuation("cancelled");
    }
    fail(
      errorDescription
        ? `${error}: ${errorDescription}`
        : `Authorization server returned error: ${error}`,
    );
    return;
  }

  const code = typeof q.code === "string" ? q.code : null;
  const state = typeof q.state === "string" ? q.state : null;
  if (!code || !state) {
    fail("Callback missing OAuth `code` or `state` query parameters.");
    return;
  }

  // OAuth `state` (CSRF) — not OID4VCI issuer_state
  const resolved = resolveAuthCodeContinuation(state);
  if (!resolved.ok) {
    const reason = resolved.reason;
    const messages = {
      missing:
        "No pending issuance session (it may already have been used or cancelled). " +
        "Start again from Scan with a fresh credential offer.",
      expired:
        "Issuer sign-in timed out (authorization_code session is valid for 15 minutes). " +
        "Start again from Scan with a fresh credential offer.",
      mismatch:
        "OAuth `state` does not match the pending issuance session. " +
        "Start again from Scan with a fresh credential offer.",
      invalid:
        "Pending issuance session was corrupt and was cleared. " +
        "Start again from Scan with a fresh credential offer.",
    } as const;
    fail(messages[reason]);
    return;
  }

  const continuation = resolved.continuation;
  walletId.value = continuation.walletId;
  statusText.value = "Unlock SECDSA key for proof of possession…";

  try {
    // Callback path has no `/wallet/:wallet` param; unlock must use the
    // continuation wallet or SoftHSM stays inactive → invalid_proof.
    const {ensureUnlocked} = useSecdsaPin();
    const unlocked = await ensureUnlocked({
      title: "Enter SECDSA PIN to finish credential receipt",
      walletId: continuation.walletId,
    });
    if (!unlocked) {
      fail("PIN unlock cancelled — credential was not fetched.");
      return;
    }

    statusText.value = "Exchanging authorization code and fetching credential…";
    await completeAuthCodeIssuance({
      walletId: continuation.walletId,
      code,
      continuation,
      did: continuation.did,
    });

    clearAuthCodeContinuation();
    await navigateTo(`/wallet/${continuation.walletId}`);
  } catch (e: any) {
    const data = e?.data;
    const msg =
      (typeof data === "string" && data) ||
      data?.message ||
      data?.statusMessage ||
      e?.message ||
      String(e);
    fail(String(msg));
  }
});
</script>
