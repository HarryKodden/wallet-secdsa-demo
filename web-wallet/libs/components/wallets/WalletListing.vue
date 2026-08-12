<template>
    <ul v-if="wallets">
        <li
            v-for="wallet in wallets"
            :key="wallet.id"
            class="flex items-center justify-between gap-x-4 py-5 border-b border-gray-100 last:border-0"
        >
            <Icon class="h-7 w-7 shrink-0 text-gray-500" name="heroicons:wallet" />
            <div class="flex min-w-0 flex-grow items-center justify-between gap-3">
                <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <template v-if="editingId === wallet.id">
                            <input
                                ref="nameInput"
                                v-model="editName"
                                type="text"
                                maxlength="80"
                                class="min-w-0 max-w-xs rounded-md border border-gray-300 px-2 py-1 text-sm font-semibold text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                @keydown.enter.prevent="saveEdit(wallet)"
                                @keydown.escape.prevent="cancelEdit"
                            />
                            <button
                                type="button"
                                class="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-50"
                                title="Save name"
                                aria-label="Save name"
                                @click="saveEdit(wallet)"
                            >
                                <Icon class="h-5 w-5" name="heroicons:check" />
                            </button>
                            <button
                                type="button"
                                class="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
                                title="Cancel"
                                aria-label="Cancel rename"
                                @click="cancelEdit"
                            >
                                <Icon class="h-5 w-5" name="heroicons:x-mark" />
                            </button>
                        </template>
                        <template v-else>
                            <p class="truncate text-base font-semibold leading-6 text-gray-900">
                                {{ wallet.name }}
                            </p>
                            <span
                                class="rounded-md whitespace-nowrap px-1.5 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200"
                            >
                                {{
                                    wallet.credentialCount === 1
                                        ? "1 credential"
                                        : `${wallet.credentialCount} credentials`
                                }}
                            </span>
                        </template>
                    </div>
                    <p class="mt-1 truncate font-mono text-[11px] leading-5 text-gray-500">
                        {{ wallet.id }}
                    </p>
                </div>
                <div class="flex flex-none items-center gap-1">
                    <button
                        type="button"
                        class="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40"
                        title="Rename wallet"
                        aria-label="Rename wallet"
                        :disabled="editingId === wallet.id"
                        @click="startEdit(wallet)"
                    >
                        <Icon class="h-5 w-5" name="heroicons:pencil-square" />
                    </button>
                    <button
                        type="button"
                        class="rounded-md p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        :title="
                            wallet.credentialCount > 0
                                ? 'Remove all credentials before deleting this wallet'
                                : 'Delete wallet'
                        "
                        aria-label="Delete wallet"
                        :disabled="wallet.credentialCount > 0 || deletingId === wallet.id"
                        @click="onDelete(wallet)"
                    >
                        <Icon
                            v-if="deletingId !== wallet.id"
                            class="h-5 w-5"
                            name="heroicons:trash"
                        />
                        <span v-else class="block h-5 w-5 animate-pulse text-xs">…</span>
                    </button>
                    <button
                        type="button"
                        class="rounded-md p-2 text-blue-700 hover:bg-blue-50"
                        title="Open wallet"
                        aria-label="Open wallet"
                        @click="selectWalletListing(wallet)"
                    >
                        <Icon class="h-5 w-5" name="heroicons:arrow-right-circle" />
                    </button>
                </div>
            </div>
        </li>
    </ul>
    <LoadingIndicator v-else />
    <p v-if="wallets && wallets.length === 0" class="mt-2 text-sm text-gray-600">No wallets.</p>
    <p v-if="deleteError" class="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
        {{ deleteError }}
    </p>
</template>

<script lang="ts" setup>
import {
    deleteWallet,
    renameWallet,
    setWallet,
    type WalletListing,
} from "../../composables/accountWallet.ts";
import LoadingIndicator from "../../components/loading/LoadingIndicator.vue";
import {navigateTo} from "nuxt/app";
import {nextTick} from "vue";

const props = defineProps<{
    useUrl: (wallet: WalletListing) => string;
    wallets: WalletListing[];
}>();

const emit = defineEmits<{
    deleted: [walletId: string];
    renamed: [walletId: string];
}>();

const deletingId = ref<string | null>(null);
const deleteError = ref("");
const editingId = ref<string | null>(null);
const editName = ref("");
const nameInput = ref<HTMLInputElement | null>(null);

function selectWalletListing(wallet: WalletListing) {
    setWallet(wallet.id, undefined);
    navigateTo(props.useUrl(wallet));
}

async function startEdit(wallet: WalletListing) {
    editingId.value = wallet.id;
    editName.value = wallet.name;
    await nextTick();
    const el = Array.isArray(nameInput.value) ? nameInput.value[0] : nameInput.value;
    el?.focus();
    el?.select();
}

function cancelEdit() {
    editingId.value = null;
    editName.value = "";
}

async function saveEdit(wallet: WalletListing) {
    const next = editName.value.trim();
    if (next && next !== wallet.name) {
        try {
            await renameWallet(wallet.id, next);
            emit("renamed", wallet.id);
        } catch (e: any) {
            deleteError.value = e?.data?.message || e?.message || String(e);
        }
    }
    cancelEdit();
}

async function onDelete(wallet: WalletListing) {
    deleteError.value = "";
    if (wallet.credentialCount > 0) {
        deleteError.value =
            "This wallet still has credentials. Delete them first, then remove the wallet.";
        return;
    }
    if (!confirm(`Delete wallet “${wallet.name}”? This cannot be undone.`)) {
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
