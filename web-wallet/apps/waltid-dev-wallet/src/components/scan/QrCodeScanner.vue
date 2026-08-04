<template>
  <div class="flex flex-col items-center">
    <div v-if="noError" class="text-center">
      <p class="font-semibold">QR code scanner</p>
      <p>Scan credential offers or presentation requests from another device:</p>
    </div>

    <LoadingIndicator v-if="isLoading || (!videoStarted && noError)">
      Camera initializing...
    </LoadingIndicator>

    <div
      :class="[(!videoStarted && isLoading) || !noError ? 'hidden' : '']"
      class="flex place-content-center place-items-center"
    >
      <VideoCameraIcon v-if="!scanned" class="absolute h-7 w-7 animate-ping" />
      <video id="scanner-video" ref="scannerVideo" class="border"></video>
    </div>

    <div v-if="!noError" class="bg-white px-4 py-5 sm:px-6 shadow">
      <div class="flex flex-row gap-1.5 place-items-center">
        <VideoCameraSlashIcon class="w-5 h-5" />
        <p class="font-semibold">{{ error.title }}</p>
      </div>
      <p>{{ error.message }}</p>
    </div>
  </div>
</template>

<script setup>
import QrScanner from "qr-scanner";
import LoadingIndicator from "@waltid-web-wallet/components/loading/LoadingIndicator.vue";
import {VideoCameraIcon, VideoCameraSlashIcon} from "@heroicons/vue/24/outline";
import {isSiopRequest} from "@waltid-web-wallet/composables/siop-requests.ts";

const emit = defineEmits(["request"]);

const isLoading = ref(true);
const videoStarted = ref(false);
const scanned = ref(false);
const error = ref({});
const noError = ref(true);
const scannerVideo = ref(null);
let qrScanner = null;

function throwError(newError) {
  isLoading.value = false;
  error.value = newError;
  noError.value = false;
  console.error(error.value.title);
  console.error(error.value.message);
}

function stopCamera() {
  if (!qrScanner) return;
  try {
    qrScanner.stop();
  } catch {
    /* already stopped */
  }
  try {
    qrScanner.destroy();
  } catch {
    /* already destroyed */
  }
  qrScanner = null;
  videoStarted.value = false;
}

async function startVideo() {
  if (await QrScanner.hasCamera()) {
    try {
      qrScanner = new QrScanner(
        scannerVideo.value,
        (result) => {
          scanned.value = true;
          const scannedText = result.data;
          if (isSiopRequest(scannedText)) {
            stopCamera();
            emit("request", scannedText);
          }
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          returnDetailedScanResult: true,
        },
      );
      isLoading.value = false;
      await qrScanner.start();
      videoStarted.value = true;
    } catch {
      throwError({
        title: "Could not start camera",
        message:
          "Could not initialize your camera. Please make sure you have accepted the camera permission in your browser.",
      });
    }
  } else {
    throwError({
      title: "No camera",
      message: "You do not have any camera available.",
    });
  }
}

onMounted(async () => {
  await startVideo();
});

onBeforeUnmount(() => {
  stopCamera();
});
</script>

<style scoped></style>
