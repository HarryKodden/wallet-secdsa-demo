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
                <p v-if="isOidcLogin && webauthnStep === 'asserting'" class="mt-3 text-sm leading-6 text-slate-300">
                    Verifying your passkey…
                </p>
                <p v-else-if="isOidcLogin" class="mt-3 text-sm leading-6 text-slate-300">
                    Completing sign-in…
                </p>
                <p v-else class="mt-3 text-sm leading-6 text-slate-300">
                    Sign in with OIDC. Your SoftHSM account is keyed by your
                    OIDC identity — new users set a 6-digit PIN on first login.
                    Connect a phone from
                    <span class="text-cyan-200">Settings → Mobile devices</span>.
                </p>

                <div v-if="isOidcLogin && webauthnStep === 'asserting'" class="mt-8 flex flex-col items-center gap-3">
                    <FingerPrintIcon class="h-12 w-12 animate-pulse text-cyan-300" />
                    <p class="text-sm text-slate-300">Touch your passkey to verify</p>
                </div>

                <p v-if="webauthnUnsupported" class="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    Passkey (WebAuthn) is not available in this browser or context.
                    Sign-in proceeds without passkey verification.
                </p>

                <div v-if="!isOidcLogin" class="mt-8 space-y-4">
                    <button
                        class="flex w-full items-center justify-center rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300"
                        type="button"
                        @click="connectOidc"
                    >
                        Sign in with SURF
                    </button>
                    <p v-if="errorMessage" class="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {{ errorMessage }}
                    </p>
                </div>

                <details v-if="!isOidcLogin" class="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
                    <summary class="cursor-pointer text-sm font-medium text-slate-300">
                        Lab / advanced — email &amp; password
                    </summary>
                    <form class="mt-4 space-y-5" @submit.prevent="login">
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

                        <button
                            class="flex w-full items-center justify-center rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15 disabled:opacity-70"
                            :disabled="isLoggingIn"
                            type="submit"
                        >
                            <span>Sign in with email</span>
                            <ArrowRightOnRectangleIcon class="ml-2 h-5 w-5" />
                        </button>
                        <p class="text-xs text-slate-400">
                            Prefer OIDC for normal use. Email remains for local lab accounts.
                            <NuxtLink class="text-cyan-300 hover:text-cyan-200" to="/signup">Create account</NuxtLink>
                        </p>
                    </form>
                </details>

                <p v-if="isOidcLogin && errorMessage" class="mt-6 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {{ errorMessage }}
                </p>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import {ArrowRightOnRectangleIcon, EnvelopeIcon, IdentificationIcon, FingerPrintIcon} from "@heroicons/vue/20/solid";
import {storeToRefs} from "pinia";
import {useUserStore} from "@waltid-web-wallet/stores/user.ts";
import {useTenant} from "@waltid-web-wallet/composables/tenants.ts";
import {get as webauthnGet, supported as webauthnSupported} from "@github/webauthn-json";
import {getOrCreateAppSalt, derivePrfKey, b64uDecode} from "@waltid-web-wallet/composables/webauthnPrf.ts";
import {useSecurityStore} from "@waltid-web-wallet/stores/security.ts";
import {useSecdsaPin} from "@waltid-web-wallet/composables/secdsaPin.ts";

const tenant = await useTenant().value;
const bgImg = tenant?.bgImage;
const logoImg = tenant?.logoImage;

const emailInput = ref("");
const passwordInput = ref("");
const isLoggingIn = ref(false);
const errorMessage = ref("");
const webauthnStep = ref<"idle" | "asserting" | "done">("idle");
const webauthnUnsupported = ref(false);

const userStore = useUserStore();
const { user } = storeToRefs(userStore);
const {ensureWscaInitialized} = useSecdsaPin();

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
    window.location.href = `/wallet-api/auth/oidc-login?redirect=${encodeURIComponent(redirectTarget)}`;
}

/**
 * Attempt a WebAuthn assertion for the given accountId.
 * - Augments server options with per-account APP_SALT as PRF eval.first
 * - Extracts and derives the PRF key client-side; stores in Pinia
 * - Strips PRF bytes before sending the assertion to the server
 * Returns true if verified (or if no passkeys registered / WebAuthn unavailable).
 */
async function assertWebAuthn(accountId: string): Promise<boolean> {
    if (!webauthnSupported()) {
        webauthnUnsupported.value = true;
        return true; // graceful degradation
    }

    webauthnStep.value = "asserting";
    try {
        const beginRes = await $fetch<{noCredentials?: boolean; extensions?: unknown; [k: string]: unknown}>(
            "/wallet-api/auth/webauthn/authenticate/begin",
            {method: "POST", body: {accountId}},
        );

        if (beginRes.noCredentials) {
            webauthnStep.value = "done";
            return true;
        }

        // Load (or create) the per-account APP_SALT for PRF domain separation
        const appSalt = await getOrCreateAppSalt(accountId);

        // Augment server options with PRF eval.first = APP_SALT (client-only).
        // eval.first MUST be a BufferSource (Uint8Array/ArrayBuffer).
        // @github/webauthn-json passes extension fields through as-is, so we
        // pass appSalt directly — NOT the base64url-encoded string.
        const optionsWithPrf = {
            ...beginRes,
            extensions: {
                ...(beginRes.extensions as object ?? {}),
                prf: {eval: {first: appSalt}},
            },
        };

        const assertion = await webauthnGet({publicKey: optionsWithPrf as any});

        // --- PRF key derivation (stays entirely in browser) ---
        // @github/webauthn-json recursively base64url-encodes ArrayBuffers in the
        // response, so prf.results.first arrives as a string.  Guard both cases.
        const prfRaw = (assertion.clientExtensionResults as any)?.prf?.results?.first;
        const prfBytes: Uint8Array | null = prfRaw
            ? typeof prfRaw === "string" ? b64uDecode(prfRaw) : new Uint8Array(prfRaw as ArrayBuffer)
            : null;
        if (prfBytes) {
            try {
                const aesKey = await derivePrfKey(prfBytes, appSalt);
                useSecurityStore().setKey(aesKey, accountId);
            } catch (e) {
                console.warn("[webauthn] PRF key derivation failed", e);
            }
        }

        // Strip PRF output before sending to server — it must not leave the browser
        const assertionForServer = {
            ...assertion,
            clientExtensionResults: {
                ...(assertion.clientExtensionResults ?? {}),
                prf: undefined,
            },
        };

        const finishRes = await $fetch<{verified: boolean}>("/wallet-api/auth/webauthn/authenticate/finish", {
            method: "POST",
            body: assertionForServer,
        });

        webauthnStep.value = "done";
        return finishRes.verified === true;
    } catch (err) {
        console.warn("WebAuthn assertion failed", err);
        webauthnStep.value = "idle";
        return false;
    }
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

        // Step 1: Sign in without redirect — WebAuthn + SECDSA PIN setup must finish first.
        const redirectTarget = signInRedirectUrl.value.startsWith("/")
            ? signInRedirectUrl.value
            : "/";
        await signIn(
            {token: tokenText, type: "oidc"},
            {redirect: false},
        );

        // Step 2: Fetch the session — gives us the real wallet-api2 accountId
        // and WSCA SoftHSM account id (OIDC `sub` via auth.wsca).
        const session = await $fetch<{
            id: string;
            email: string;
            friendlyName: string;
            oidcSession: boolean;
            token?: string;
            wscaAccountId?: string;
            walletIds?: string[];
        }>("/wallet-api/auth/session", {credentials: "include"});

        // Step 3: WebAuthn second-factor gate.
        // auth.token is now set so the begin endpoint resolves the account from the
        // cookie even without an explicit accountId; we pass it for explicitness.
        // The gate is skipped gracefully when no passkey is registered, or when
        // WebAuthn is unavailable in the browser.
        if (session.id) {
            const ok = await assertWebAuthn(session.id);
            if (!ok) {
                // Revoke the session so the user is not left signed in.
                await $fetch("/wallet-api/auth/logout", {method: "POST"}).catch(() => {});
                errorMessage.value = "Passkey verification failed. Please try again.";
                isLoggingIn.value = false;
                isOidcLogin.value = false;
                return;
            }
        }

        user.value = {
            token: session.token || "",
            id: session.id,
            email: session.email,
            friendlyName: session.friendlyName || session.email || "n/a",
            oidcSession: true,
            wscaAccountId: session.wscaAccountId || "",
        };

        // Step 4: First-time SECDSA users choose a 6-digit PIN to activate WSCA
        // for their OIDC `sub` account. Returning users skip this.
        if (session.wscaAccountId) {
            const walletId = session.walletIds?.[0] ?? null;
            const initialized = await ensureWscaInitialized({
                accountId: session.wscaAccountId,
                walletId,
            });
            if (!initialized) {
                await $fetch("/wallet-api/auth/logout", {method: "POST"}).catch(() => {});
                errorMessage.value = "SECDSA PIN setup is required to continue.";
                isLoggingIn.value = false;
                isOidcLogin.value = false;
                return;
            }
        }

        await navigateTo(redirectTarget);

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
