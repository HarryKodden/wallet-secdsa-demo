<template>
  <Html :lang="locale" class="h-full">
    <Head>
      <Link :href="logoImg" rel="icon" type="image/png" />
    </Head>
    <!--<head>
          <link rel="icon" type="image/png" href="/svg/digital-wallet.png">
        </head>-->

    <Body
      class="theme-surf bg-white text-gray-800 antialiased transition-colors duration-300 h-full"
      :data-app-version="appVersion"
    >
      <!-- dark:bg-gray-900 dark:text-gray-200 -->
      <ModalBase />
      <VitePwaManifest />
      <NuxtLoadingIndicator />
      <!--            {{ tenant }}-->
      <NuxtLayout class="h-full">
        <NuxtPage class="h-full" />
      </NuxtLayout>
    </Body>
  </Html>
</template>

<script lang="ts" setup>
import "@unocss/reset/tailwind-compat.css";
import "uno.css";
import {useTenant} from "@waltid-web-wallet/composables/tenants.ts";
import ModalBase from "@waltid-web-wallet/components/modals/ModalBase.vue";

const locale = useState<string>("locale.i18n");
const runtimeConfig = useRuntimeConfig();
const appVersion = computed(() => String(runtimeConfig.public.appVersion || "dev"));

onMounted(async () => {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  if ("caches" in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((key) => caches.delete(key)));
  }
});

const tenant = await useTenant().value;
const name = tenant?.name;
const logoImg = tenant?.logoImage;
</script>

<style lang="postcss">
/*body {
    @apply bg-gray-50 dark:bg-gray-800;
}

.global-text {
    @apply text-gray-900 dark:text-gray-50;
}
*/
#__nuxt {
  height: 100%;
}

/* Diagonal version ribbon (upper-right), SURF theme convention */
body.theme-surf {
  overflow-x: hidden;
}
body.theme-surf[data-app-version]::after {
  position: fixed;
  width: 120px;
  height: 28px;
  top: 15px;
  right: -30px;
  z-index: 9999;
  pointer-events: none;
  text-align: center;
  font-size: 12px;
  font-family: system-ui, -apple-system, sans-serif;
  text-transform: uppercase;
  font-weight: 700;
  color: #fff;
  line-height: 28px;
  transform: rotate(45deg);
  background: #c62828;
  content: attr(data-app-version);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}
</style>
