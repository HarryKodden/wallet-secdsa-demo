<template>
    <PageHeader>
        <template v-slot:icon>
            <img alt="" class="hidden h-16 w-16 rounded-full sm:block" src="/svg/digital-wallet.png"/>
        </template>

        <template v-slot:title>
            <img alt="" class="h-16 w-16 rounded-full sm:hidden" src="/svg/digital-wallet.png"/>
            <h1 class="ml-3 text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:leading-9">
                <!-- Wallet page: displayName, else full wallet UUID (never the user greeting). -->
                <template v-if="routeWalletId">
                    <span
                        :class="headerTitle.length > 25 ? 'truncate inline-block max-w-xs align-bottom sm:max-w-md' : ''"
                        :title="headerTitle"
                    >
                        {{ headerTitle }}
                    </span>
                </template>
                <!-- Wallet picker / other pages: time-of-day greeting + user. -->
                <template v-else>
                    Good <span v-if="now.getHours() < 12">morning</span>
                    <span v-else-if="now.getHours() > 21">night</span>
                    <span v-else-if="now.getHours() > 18">evening</span>
                    <span v-else-if="now.getHours() >= 12">afternoon</span>
                    <span v-if="user?.friendlyName">, </span>
                    <span
                        :class="user?.friendlyName?.length > 25 ? 'truncate inline-block max-w-xs align-bottom' : ''"
                        :title="user?.friendlyName"
                    >
                        {{ user.friendlyName }}
                    </span>
                </template>
            </h1>
        </template>

        <template v-slot:menu v-if="currentWallet">
            <NuxtLink
                class="inline-flex focus:outline focus:outline-blue-600 focus:outline-offset-2 items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                :to="`/wallet/${currentWallet}/settings/issuers`" type="button" v-if="currentWallet">
                <ArrowDownOnSquareStackIcon class="h-5 w-5 mr-1"/>
                Request credentials
            </NuxtLink>
            <NuxtLink
                class="inline-flex focus:outline focus:outline-blue-600 focus:outline-offset-2 items-center rounded-md bg-blue-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                :to="`/wallet/${currentWallet}/scan`" type="button">
                <QrCodeIcon class="h-5 w-5 mr-1"/>
                Scan to receive or present credentials
            </NuxtLink>
            <NuxtLink
                class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                :to="`/wallet/${currentWallet}/import`"
                type="button"
            >
                <ArrowDownIcon class="h-5 w-5 mr-1"/>
                Import credential (JWT)
            </NuxtLink>
        </template>
    </PageHeader>
</template>

<script setup>
import {useNow} from "@vueuse/core";
import {
    listWallets,
    useCurrentWallet,
    useCurrentWalletDisplayName,
    useWalletListings,
} from "@waltid-web-wallet/composables/accountWallet.ts";
import {ArrowDownOnSquareStackIcon, QrCodeIcon, ArrowDownIcon} from "@heroicons/vue/24/outline";
import PageHeader from "./PageHeader.vue";
import {useUserStore} from "../stores/user.ts";
import {storeToRefs} from "pinia";

const userStore = useUserStore();
const {user} = storeToRefs(userStore);

const route = useRoute();
const currentWallet = useCurrentWallet();
const walletDisplayName = useCurrentWalletDisplayName();
const listings = useWalletListings();

/** Wallet id from `/wallet/:wallet/...` — drives title vs greeting. */
const routeWalletId = computed(() => {
    const raw = route.params.wallet;
    if (typeof raw === "string" && raw.length > 0) return raw;
    if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].length > 0) return raw[0];
    return null;
});

/**
 * displayName when set; otherwise the wallet UUID.
 * Always a non-empty string when routeWalletId is set.
 */
const headerTitle = computed(() => {
    const id = routeWalletId.value;
    if (!id) return "";
    const named = walletDisplayName.value?.trim();
    // useCurrentWalletDisplayName already returns name or id; prefer listing displayName, else UUID
    if (named && named !== id) return named;
    const fromList = listings.value?.wallets?.find((w) => w.id === id)?.displayName?.trim();
    return fromList || id;
});

onMounted(async () => {
    const id = routeWalletId.value;
    if (!id) return;
    const known = listings.value?.wallets?.find((w) => w.id === id);
    if (!known || known.displayName == null) {
        try {
            await listWallets();
        } catch (e) {
            console.warn("Could not load wallet display name", e);
        }
    }
});

const now = useNow();
</script>
