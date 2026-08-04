<template>
  <div
    class="rounded-2xl border border-blue-200 bg-blue-50/60 p-4"
    @dragover.prevent
    @drop.prevent="onDrop"
    @paste="onContainerPaste"
  >
    <h2 class="text-base font-semibold text-gray-900">Paste QR image or offer link</h2>
    <p class="mt-1 text-sm text-gray-600">
      Same device can’t scan its own screen. Copy the <strong>QR image</strong> or the offer
      link from the issuer tab, then paste here (⌘V / Ctrl+V) — or upload a screenshot.
    </p>

    <form class="mt-3" @submit.prevent="startRequest">
      <label class="sr-only" for="manual-request">Offer or presentation URL</label>
      <textarea
        id="manual-request"
        ref="textareaRef"
        v-model="text"
        class="block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
        name="manual-request"
        placeholder="Paste a QR image (⌘V) or an openid-credential-offer:// / https://… link"
        rows="4"
      />

      <p v-if="status === 'error'" class="mt-2 text-sm font-medium text-red-600">
        Not a valid offer or presentation request.
      </p>
      <p v-else-if="hint" class="mt-2 text-sm font-medium text-amber-800">
        {{ hint }}
      </p>
      <p v-else-if="status === 'ok'" class="mt-2 text-sm text-green-700">
        Recognized as {{ requestTypeLabel }}.
      </p>

      <div class="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button
          :disabled="busy"
          class="inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-60"
          type="button"
          @click="pasteFromClipboard"
        >
          {{ pasting ? "Reading clipboard…" : "Paste from clipboard" }}
        </button>

        <label
          class="inline-flex cursor-pointer items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          <input
            accept="image/*"
            class="sr-only"
            type="file"
            @change="onImageSelected"
          />
          {{ decodingImage ? "Reading QR…" : "Upload QR image" }}
        </label>

        <button
          :disabled="status !== 'ok' || busy"
          class="inline-flex items-center rounded-md bg-blue-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-gray-400"
          type="submit"
        >
          {{ requestTypeName }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import QrScanner from "qr-scanner";
import {
    getSiopRequestType,
    isSiopRequest,
    normalizeRequest,
    SiopRequestType,
} from "@waltid-web-wallet/composables/siop-requests.ts";

const emit = defineEmits<{ request: [string] }>();

const text = ref("");
const hint = ref("");
const pasting = ref(false);
const decodingImage = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const busy = computed(() => pasting.value || decodingImage.value);

const status = computed(() => {
  if (!text.value.trim()) return "empty";
  if (!isSiopRequest(text.value)) return "error";
  return "ok";
});

const requestType = computed(() => getSiopRequestType(text.value));

const requestTypeLabel = computed(() => {
  if (requestType.value === SiopRequestType.PRESENTATION) return "a presentation request";
  if (requestType.value === SiopRequestType.ISSUANCE) return "a credential offer";
  return "a request";
});

const requestTypeName = computed(() => {
  if (requestType.value === SiopRequestType.PRESENTATION) return "Present credential";
  if (requestType.value === SiopRequestType.ISSUANCE) return "Receive credential";
  return "Continue";
});

function applyPastedText(raw: string, {autoContinue = true} = {}): boolean {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return false;
  text.value = trimmed;
  hint.value = "";
  if (autoContinue && isSiopRequest(trimmed)) {
    emit("request", normalizeRequest(trimmed));
    text.value = "";
    return true;
  }
  if (!isSiopRequest(trimmed)) {
    hint.value =
      "Got text from the QR/clipboard, but it is not a recognized offer or presentation link.";
  }
  return isSiopRequest(trimmed);
}

function startRequest() {
  if (status.value !== "ok") return;
  emit("request", normalizeRequest(text.value));
  text.value = "";
  hint.value = "";
}

function extractOfferText(plain: string, html = ""): string {
  const fromPlain = (plain || "").trim();
  if (fromPlain) return fromPlain;
  const fromHtml = (html || "").trim();
  if (!fromHtml) return "";
  const href = fromHtml.match(/href=["']([^"']+)["']/i)?.[1];
  if (href) {
    try {
      return decodeURIComponent(href.replace(/&amp;/g, "&"));
    } catch {
      return href.replace(/&amp;/g, "&");
    }
  }
  const url = fromHtml.match(
    /(openid(?:4vp)?|openid-credential-offer|openid-initiate-issuance|openid-vc|https?):\/\/[^"'<\s]+/i,
  )?.[0];
  return url ? url.replace(/&amp;/g, "&") : "";
}

async function decodeQrFromBlob(blob: Blob): Promise<string> {
  const type = blob.type || "image/png";
  const file = new File([blob], `clipboard.${type.split("/")[1] || "png"}`, {type});
  const result = await QrScanner.scanImage(file, {returnDetailedScanResult: true});
  const scanned = typeof result === "string" ? result : result.data;
  return (scanned || "").trim();
}

async function handleImageBlob(blob: Blob): Promise<boolean> {
  decodingImage.value = true;
  try {
    const scanned = await decodeQrFromBlob(blob);
    if (!scanned) {
      hint.value = "Clipboard image has no readable QR code. Try a clearer copy/screenshot.";
      return false;
    }
    return applyPastedText(scanned, {autoContinue: true});
  } catch (e: any) {
    hint.value =
      e?.message || "Could not decode QR from the clipboard image. Try Upload QR image instead.";
    return false;
  } finally {
    decodingImage.value = false;
  }
}

/** Paste on the card (images don’t land in a textarea — must handle here). */
async function onContainerPaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items;
  if (items) {
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) await handleImageBlob(file);
        return;
      }
    }
  }

  const pasted = extractOfferText(
    event.clipboardData?.getData("text/plain") || event.clipboardData?.getData("text") || "",
    event.clipboardData?.getData("text/html") || "",
  );
  if (!pasted.trim()) return;
  event.preventDefault();
  applyPastedText(pasted, {autoContinue: true});
}

async function readClipboard(): Promise<{kind: "text" | "image"; value: string | Blob} | null> {
  if (!window.isSecureContext || !navigator.clipboard?.read) return null;
  try {
    const items = await navigator.clipboard.read();
    // Prefer image — issuer pages usually put the QR bitmap on the clipboard
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith("image/"));
      if (imageType) {
        return {kind: "image", value: await item.getType(imageType)};
      }
    }
    let plain = "";
    let html = "";
    for (const item of items) {
      if (item.types.includes("text/plain")) {
        plain = await (await item.getType("text/plain")).text();
      }
      if (item.types.includes("text/html")) {
        html = await (await item.getType("text/html")).text();
      }
    }
    const textValue = extractOfferText(plain, html);
    if (textValue) return {kind: "text", value: textValue};
  } catch (err: any) {
    console.warn("navigator.clipboard.read failed:", err?.name || err);
  }

  if (navigator.clipboard.readText) {
    try {
      const t = (await navigator.clipboard.readText())?.trim();
      if (t) return {kind: "text", value: t};
    } catch (err: any) {
      console.warn("navigator.clipboard.readText failed:", err?.name || err);
    }
  }
  return null;
}

async function pasteFromClipboard() {
  hint.value = "";
  pasting.value = true;
  try {
    const clip = await readClipboard();
    if (clip?.kind === "image") {
      await handleImageBlob(clip.value as Blob);
      return;
    }
    if (clip?.kind === "text") {
      applyPastedText(clip.value as string, {autoContinue: true});
      return;
    }

    // API empty/blocked — focus card and wait for ⌘V (handles image paste via onContainerPaste)
    await nextTick();
    textareaRef.value?.focus();
    hint.value =
      "Clipboard has no text (QR images are OK). Click this box and press ⌘V / Ctrl+V, or use Upload QR image.";
  } finally {
    pasting.value = false;
  }
}

async function onImageSelected(event: Event) {
  hint.value = "";
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  await handleImageBlob(file);
}

async function onDrop(event: DragEvent) {
  const file = event.dataTransfer?.files?.[0];
  if (file?.type.startsWith("image/")) {
    hint.value = "";
    await handleImageBlob(file);
  }
}

onMounted(() => {
  textareaRef.value?.focus();
});
</script>
