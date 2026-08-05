<template>
  <div v-if="visible" class="mb-4" role="status">
    <div
      v-if="mode === 'pending'"
      class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
    >
      <p class="font-medium">Issuer sign-in in progress</p>
      <p class="mt-1 text-amber-900/90">
        Waiting for authorization-code return
        <span v-if="configLabel">
          for <code class="text-xs">{{ configLabel }}</code>
        </span>
        . Session expires in <strong>{{ remainingLabel }}</strong>.
      </p>
      <div class="mt-2 flex flex-wrap gap-3">
        <button
          type="button"
          class="font-medium text-amber-950 underline hover:no-underline"
          @click="onCancel"
        >
          Cancel issuance
        </button>
        <NuxtLink
          v-if="scanHref"
          class="font-medium text-amber-950/80 underline hover:no-underline"
          :to="scanHref"
        >
          Back to Scan
        </NuxtLink>
      </div>
    </div>

    <div
      v-else-if="mode === 'notice'"
      class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
    >
      <p class="font-medium">
        {{
          noticeKind === "expired"
            ? "Issuer sign-in timed out"
            : "Issuer sign-in cancelled"
        }}
      </p>
      <p class="mt-1 text-slate-700">
        {{
          noticeKind === "expired"
            ? "The authorization_code session expired (15 minutes). Start again from Scan with a fresh offer."
            : "The pending authorization_code session was cleared. Start again from Scan when ready."
        }}
      </p>
      <button
        type="button"
        class="mt-2 font-medium text-slate-800 underline hover:no-underline"
        @click="dismissNotice"
      >
        Dismiss
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {
    cancelAuthCodeContinuation,
    consumeAuthCodeNotice,
    formatAuthCodeRemaining,
    peekAuthCodeContinuation,
    type AuthCodeSessionNotice,
} from "../../composables/oid4vciAuthCode.ts";
import {useCurrentWallet} from "../../composables/accountWallet.ts";

const props = defineProps<{
    /** When set, only show sessions for this wallet id. */
    walletId?: string | null;
}>();

const currentWallet = useCurrentWallet();
const effectiveWalletId = computed(
    () => props.walletId || currentWallet.value || null,
);

const mode = ref<"hidden" | "pending" | "notice">("hidden");
const remainingLabel = ref("");
const configLabel = ref<string | null>(null);
const noticeKind = ref<AuthCodeSessionNotice["kind"]>("cancelled");
let tickTimer: ReturnType<typeof setInterval> | null = null;

const visible = computed(() => mode.value !== "hidden");

const scanHref = computed(() => {
    const id = effectiveWalletId.value;
    return id ? `/wallet/${id}/scan` : null;
});

function stopTick() {
    if (tickTimer != null) {
        clearInterval(tickTimer);
        tickTimer = null;
    }
}

function matchesWallet(walletId: string | null | undefined): boolean {
    const current = effectiveWalletId.value;
    if (!current || !walletId) return true;
    return walletId === current;
}

function refresh() {
    const notice = consumeAuthCodeNotice(effectiveWalletId.value);
    if (notice) {
        stopTick();
        noticeKind.value = notice.kind;
        mode.value = "notice";
        return;
    }

    const peeked = peekAuthCodeContinuation();
    if (peeked.status === "pending") {
        if (!matchesWallet(peeked.continuation.walletId)) {
            mode.value = "hidden";
            stopTick();
            return;
        }
        configLabel.value = peeked.continuation.credentialConfigurationId || null;
        remainingLabel.value = formatAuthCodeRemaining(peeked.remainingMs);
        mode.value = "pending";
        if (!tickTimer) {
            tickTimer = setInterval(() => {
                const again = peekAuthCodeContinuation();
                if (again.status === "pending") {
                    remainingLabel.value = formatAuthCodeRemaining(again.remainingMs);
                    return;
                }
                if (again.status === "expired") {
                    cancelAuthCodeContinuation("expired");
                    noticeKind.value = "expired";
                    mode.value = "notice";
                } else {
                    mode.value = "hidden";
                }
                stopTick();
            }, 1000);
        }
        return;
    }

    if (peeked.status === "expired") {
        if (!matchesWallet(peeked.continuation.walletId)) {
            mode.value = "hidden";
            stopTick();
            return;
        }
        cancelAuthCodeContinuation("expired");
        noticeKind.value = "expired";
        mode.value = "notice";
        stopTick();
        return;
    }

    mode.value = "hidden";
    stopTick();
}

function onCancel() {
    cancelAuthCodeContinuation("cancelled");
    noticeKind.value = "cancelled";
    mode.value = "notice";
    stopTick();
}

function dismissNotice() {
    mode.value = "hidden";
}

onMounted(() => {
    refresh();
});

onBeforeUnmount(() => {
    stopTick();
});

watch(effectiveWalletId, () => refresh());
</script>
