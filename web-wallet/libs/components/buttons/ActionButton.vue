<template>
    <button :disabled="loading" class="" @click="handleClick">
        <Icon v-if="failed && !loading" class="h-5 w-5 mr-1" name="heroicons:exclamation-circle" />
        <Icon v-else-if="!loading" :name="icon" class="h-5 w-5 mr-1" />
        <InlineLoadingCircle v-else class="h-5 w-5 pr-2" />
        <span v-if="!loading">{{ props.displayText }}</span>
        <span v-else>{{ props.actionText ?? props.displayText }}</span>
    </button>
</template>

<script setup>
import InlineLoadingCircle from "../loading/InlineLoadingCircle.vue";

const emit = defineEmits(["click"]);
const props = defineProps(["handler", "icon", "failedIcon", "failed", "displayText", "actionText"]);

const loading = ref(false);

async function handleClick() {
    if (loading.value) return;
    loading.value = true;
    try {
        if (typeof props.handler === "function") {
            await props.handler();
        } else {
            emit("click");
        }
    } catch (_) {
        // Caller surfaces errors (e.g. failed + failMessage)
    } finally {
        loading.value = false;
    }
}
</script>

<style scoped></style>
