<template>
    <ul v-if="wallets">
        <li v-for="wallet in wallets" class="flex items-center justify-between gap-x-6 py-5">
            <Icon class="h-7 w-7" name="heroicons:wallet" />
            <div class="flex items-center justify-between flex-grow">

                <div class="min-w-0">
                    <div class="flex items-start gap-x-3">
                        <p class="text-base font-semibold leading-6 text-gray-900">{{ wallet.name }}</p>
                        <p
                            class="rounded-md whitespace-nowrap mt-0.5 px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset">
                            {{ wallet.permission }}
                        </p>
                    </div>
                    <div class="mt-1 flex items-center gap-x-2 text-sm leading-5 text-gray-500">
                        <p class="whitespace-nowrap">
                            Added on
                            <time :datetime="wallet.addedOn">{{ wallet.addedOn }}</time>
                        </p>
                        <svg class="h-0.5 w-0.5 fill-current" viewBox="0 0 2 2">
                            <circle cx="1" cy="1" r="1" />
                        </svg>
                        <p class="whitespace-nowrap">
                            Created on
                            <time :datetime="wallet.createdOn">{{ wallet.createdOn }}</time>
                        </p>
                    </div>
                </div>
                <div class="flex flex-none items-center gap-x-4">
                    <button
                        type="button"
                        class="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-red-700 shadow-sm ring-1 ring-inset ring-red-200 hover:bg-red-50 disabled:opacity-60"
                        :disabled="deletingId === wallet.id"
                        @click="onDelete(wallet)"
                    >
                        {{ deletingId === wallet.id ? "Deleting…" : "Delete" }}
                    </button>
                    <button
                        class="flex items-center gap-1 rounded-md bg-white px-2.5 py-1.5 text-base font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        @click="selectWalletListing(wallet)">
                        Select wallet
                        <Icon class="h-5 w-5" name="heroicons:chevron-right" />
                    </button>
                </div>
            </div>
        </li>
    </ul>
    <LoadingIndicator v-else />
    <p v-if="wallets && wallets.length == 0" class="mt-2">No wallets.</p>
    <p v-if="deleteError" class="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
        {{ deleteError }}
    </p>
</template>

<script lang="ts" setup>
import {deleteWallet, setWallet, type WalletListing} from "../../composables/accountWallet.ts";
import LoadingIndicator from "../../components/loading/LoadingIndicator.vue";
import {navigateTo} from "nuxt/app";

const props = defineProps<{
    useUrl: (wallet: WalletListing) => string;
    wallets: WalletListing[]
}>();

const emit = defineEmits<{
    deleted: [walletId: string];
}>();

const deletingId = ref<string | null>(null);
const deleteError = ref("");

function selectWalletListing(wallet: WalletListing) {
    setWallet(wallet.id, undefined)
    const dynamicUrl = props.useUrl(wallet)
    console.log("Dynamic url: ", dynamicUrl)
    navigateTo(dynamicUrl)
}

async function onDelete(wallet: WalletListing) {
    deleteError.value = "";
    if (!confirm(`Delete wallet ${wallet.name}? Only empty wallets (no credentials) can be deleted.`)) {
        return;
    }
    deletingId.value = wallet.id;
    try {
        await deleteWallet(wallet.id);
        emit("deleted", wallet.id);
    } catch (e: any) {
        deleteError.value = e?.data?.message || e?.message || String(e);
    } finally {
        deletingId.value = null;
    }
}

</script>

<style scoped></style>
