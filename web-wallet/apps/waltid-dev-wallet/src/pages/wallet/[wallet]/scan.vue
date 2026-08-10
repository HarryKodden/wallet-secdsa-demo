<template>
  <CenterMain>
    <BackButton />
    <div class="max-w-3xl">
      <h1 class="text-2xl font-semibold text-gray-900">Receive or present</h1>
      <p class="mt-1 text-sm text-gray-600">
        Paste a link or screenshot from another tab, or scan a QR from a second
        device. When a local issuer/verifier is configured, the lab panel appears
        above.
      </p>

      <div class="mt-4">
        <AuthCodePendingBanner :wallet-id="currentWallet" />
      </div>

      <div class="mt-6">
        <LocalLabPanel @request="startRequest" />
      </div>

      <div class="mt-6">
        <ManualRequestEntry @request="startRequest" />
      </div>

      <div class="relative my-8">
        <div aria-hidden="true" class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-300" />
        </div>
        <div class="relative flex justify-center">
          <span class="bg-white px-2 text-sm text-gray-500">or scan with camera</span>
        </div>
      </div>

      <QrCodeScanner @request="startRequest" />
    </div>
  </CenterMain>
</template>

<script setup>
import QrCodeScanner from "~/components/scan/QrCodeScanner.vue";
import BackButton from "@waltid-web-wallet/components/buttons/BackButton.vue";
import CenterMain from "@waltid-web-wallet/components/CenterMain.vue";
import LocalLabPanel from "~/components/scan/LocalLabPanel.vue";
import ManualRequestEntry from "~/components/scan/ManualRequestEntry.vue";
import AuthCodePendingBanner from "@waltid-web-wallet/components/issuance/AuthCodePendingBanner.vue";
import {useCurrentWallet} from "@waltid-web-wallet/composables/accountWallet.ts";
import {
  encodeRequest,
  getSiopRequestType,
  normalizeRequest,
  SiopRequestType,
} from "@waltid-web-wallet/composables/siop-requests.ts";

const currentWallet = useCurrentWallet();

async function startRequest(request) {
  request = normalizeRequest(request);
  const type = getSiopRequestType(request);

  const encoded = encodeRequest(request);

  if (type === SiopRequestType.ISSUANCE) {
    await redirectByOfferType(request, encoded);
  } else if (type === SiopRequestType.PRESENTATION) {
    await navigateTo({
      path: `/wallet/${currentWallet.value}/exchange/presentation`,
      query: { request: encoded },
    });
  } else {
    console.error("Unknown SIOP request type", request);
    await navigateTo({
      path: `/wallet/${currentWallet.value}/exchange/error`,
      query: { message: btoa("Unknown request type") },
    });
  }
}

function redirectByOfferType(offerUrl, encoded) {
  if (offerUrl.startsWith("openid-vc://")) {
    return navigateTo({
      path: `/wallet/${currentWallet.value}/exchange/entra/issuance`,
      query: { request: encoded },
    });
  }
  return navigateTo({
    path: `/wallet/${currentWallet.value}/exchange/issuance`,
    query: { request: encoded },
  });
}

useHead({ title: "Scan / paste offer - walt.id" });
</script>

<style scoped></style>
