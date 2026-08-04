<template>
    <div class="relative flex min-h-full overflow-hidden bg-slate-950 text-slate-100">
        <div class="absolute inset-0">
            <img
                :src="bgImg"
                alt="Wallet background"
                class="h-full w-full object-cover opacity-35 blur-[1px]"
            />
            <div class="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/30" />
        </div>

        <div class="relative z-10 flex w-full items-center justify-center px-6 py-12 lg:justify-start lg:px-16 xl:px-24">
            <div class="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
                <img
                    :src="logoImg"
                    alt="walt.id logo"
                    class="mx-auto h-16 w-auto"
                />

                <h1 class="mt-6 text-3xl font-semibold tracking-tight text-white">
                    Sign in to your SSI wallet
                </h1>
                <p v-if="isOidcLogin" class="mt-3 text-sm leading-6 text-slate-300">
                    Completing SURF sign-in…
                </p>
                <p v-else class="mt-3 text-sm leading-6 text-slate-300">
                    Use your email and password.
                    <NuxtLink class="font-medium text-cyan-300 hover:text-cyan-200" to="/signup">
                        Create an account
                    </NuxtLink>
                    if you do not have one yet.
                </p>

                <div v-if="!isOidcLogin" class="mt-8">
                    <button
                        class="flex w-full items-center justify-center rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-white/15 transition hover:bg-white/15"
                        type="button"
                        @click="connectOidc"
                    >
                        Sign in with SURF
                    </button>
                </div>

                <div v-if="!isOidcLogin" class="my-7 flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-slate-400">
                    <span class="h-px flex-1 bg-white/10" />
                    <span>or email</span>
                    <span class="h-px flex-1 bg-white/10" />
                </div>

                <form v-if="!isOidcLogin" class="space-y-5" @submit.prevent="login">
                    <div>
                        <label class="block text-sm font-medium text-slate-200" for="email">
                            <span class="flex items-center gap-2">
                                <EnvelopeIcon class="h-5 w-5" />
                                Email address
                            </span>
                        </label>
                        <div class="mt-2">
                            <input
                                id="email"
                                v-model="emailInput"
                                autocomplete="email"
                                autofocus
                                class="block w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-slate-100 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/40"
                                name="email"
                                required
                                type="email"
                            />
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-slate-200" for="password">
                            <span class="flex items-center gap-2">
                                <IdentificationIcon class="h-5 w-5" />
                                Password
                            </span>
                        </label>
                        <div class="mt-2">
                            <input
                                id="password"
                                v-model="passwordInput"
                                autocomplete="current-password"
                                class="block w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2.5 text-slate-100 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/40"
                                name="password"
                                required
                                type="password"
                            />
                        </div>
                    </div>

                    <p v-if="errorMessage" class="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {{ errorMessage }}
                    </p>

                    <button
                        class="flex w-full items-center justify-center rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
                        :disabled="isLoggingIn"
                        type="submit"
                    >
                        <span>Sign in</span>
                        <svg
                            v-if="isLoggingIn"
                            class="ml-2 h-5 w-5 animate-spin text-slate-950"
                            fill="none"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <circle
                                class="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                stroke-width="4"
                            />
                            <path
                                class="opacity-75"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                fill="currentColor"
                            />
                        </svg>
                        <ArrowRightOnRectangleIcon v-else class="ml-2 h-5 w-5" />
                    </button>
                </form>

                <p v-if="isOidcLogin && errorMessage" class="mt-6 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {{ errorMessage }}
                </p>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import {ArrowRightOnRectangleIcon, EnvelopeIcon, IdentificationIcon} from "@heroicons/vue/20/solid";
import {storeToRefs} from "pinia";
import {useUserStore} from "@waltid-web-wallet/stores/user.ts";
import {useTenant} from "@waltid-web-wallet/composables/tenants.ts";

const tenant = await useTenant().value;
const bgImg = tenant?.bgImage;
const logoImg = tenant?.logoImage;

const emailInput = ref("");
const passwordInput = ref("");
const isLoggingIn = ref(false);
const errorMessage = ref("");
const userStore = useUserStore();
const { user } = storeToRefs(userStore);

const {signIn} = useAuth();
const route = useRoute();
const signInRedirectUrl = ref("/");

if (route.redirectedFrom != undefined) {
    signInRedirectUrl.value = route.redirectedFrom.fullPath;
} else if (typeof route.query.redirect === "string" && route.query.redirect.startsWith("/")) {
    signInRedirectUrl.value = route.query.redirect;
}

const isOidcLogin = ref(route.query.oidc_login === "true");

function connectOidc() {
    const redirectTarget =
        typeof route.query.redirect === "string" && route.query.redirect.startsWith("/")
            ? route.query.redirect
            : signInRedirectUrl.value;
    // Server-side OIDC start (same contract as classic wallet-api).
    window.location.href = `/wallet-api/auth/oidc-login?redirect=${encodeURIComponent(redirectTarget)}`;
}

async function tryLoginWithOidcSession() {
    isLoggingIn.value = true;
    errorMessage.value = "";

    try {
        const tokenResponse = await fetch("/wallet-api/auth/oidc-token", {
            redirect: "manual",
            credentials: "include",
        });
        if (!tokenResponse.ok) {
            throw new Error(await tokenResponse.text());
        }

        const tokenText = await tokenResponse.text();
        const redirectTarget = signInRedirectUrl.value;

        // Nitro exchanges the SURF JWT for a wallet-api2 session (ownership JWT).
        await signIn(
            {token: tokenText, type: "oidc"},
            {callbackUrl: redirectTarget.startsWith("/") ? redirectTarget : "/"}
        );

        const session = await $fetch<{
            id: string;
            email: string;
            friendlyName: string;
            oidcSession: boolean;
            token?: string;
        }>("/wallet-api/auth/session", {credentials: "include"});

        user.value = {
            token: session.token || "",
            id: session.id,
            email: session.email,
            friendlyName: session.friendlyName || session.email || "n/a",
            oidcSession: true,
        };
    } catch (err) {
        console.error("OIDC sign in failed", err);
        errorMessage.value = "Your OIDC sign in failed.";
        isOidcLogin.value = false;
        isLoggingIn.value = false;
    }
}

if (isOidcLogin.value) {
    void tryLoginWithOidcSession();
}

async function login() {
    isLoggingIn.value = true;
    errorMessage.value = "";

    try {
        await signIn(
            {email: emailInput.value, password: passwordInput.value},
            {callbackUrl: signInRedirectUrl.value}
        );
    } catch {
        errorMessage.value = "Please check that you have entered the correct email address and password.";
    } finally {
        isLoggingIn.value = false;
    }
}

definePageMeta({
    title: "Login to your wallet - walt.id",
    layout: "minimal",
    auth: {
        unauthenticatedOnly: true,
        navigateAuthenticatedTo: "/"
    }
});

useHead({
    title: "Login to your wallet - walt.id"
});
</script>
