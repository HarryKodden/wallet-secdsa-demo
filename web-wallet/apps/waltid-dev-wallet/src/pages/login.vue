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
                <p v-else-if="isOidcLogin && needsPasskeySetup" class="mt-3 text-sm leading-6 text-slate-300">
                    Register a passkey to secure your wallet and enable silent PIN unlock.
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

                <!-- Passkey setup panel — shown to first-time users who have no passkeys yet -->
                <div v-if="isOidcLogin && needsPasskeySetup" class="mt-8 space-y-4">
                    <div class="rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-4">
                        <p class="text-sm font-semibold text-cyan-200">Passkey required</p>
                        <p class="mt-1 text-sm text-slate-300">
                            Your SECDSA PIN will be encrypted with a passkey-derived key so
                            future logins never ask for your PIN. Register a passkey now to continue.
                        </p>
                    </div>
                    <button
                        class="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300 disabled:opacity-60"
                        :disabled="isRegisteringPasskey"
                        type="button"
                        @click="registerAndAssert(passkeySetupAccountId)"
                    >
                        <FingerPrintIcon class="h-5 w-5" />
                        {{ isRegisteringPasskey ? 'Registering passkey…' : 'Register passkey' }}
                    </button>
                    <p v-if="errorMessage" class="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {{ errorMessage }}
                    </p>
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

                <p v-if="isOidcLogin && errorMessage" class="mt-6 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {{ errorMessage }}
                </p>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import {FingerPrintIcon} from "@heroicons/vue/20/solid";
import {storeToRefs} from "pinia";
import {useUserStore} from "@waltid-web-wallet/stores/user.ts";
import {useTenant} from "@waltid-web-wallet/composables/tenants.ts";
import {
    get as webauthnGet,
    create as webauthnCreate,
    supported as webauthnSupported,
    parseCreationOptionsFromJSON,
    parseRequestOptionsFromJSON,
} from "@github/webauthn-json/browser-ponyfill";
import {getOrCreateAppSalt, derivePrfKey, decryptPin} from "@waltid-web-wallet/composables/webauthnPrf.ts";
import {useSecurityStore} from "@waltid-web-wallet/stores/security.ts";
import {useSecdsaPin} from "@waltid-web-wallet/composables/secdsaPin.ts";

const tenant = await useTenant().value;
const bgImg = tenant?.bgImage;
const logoImg = tenant?.logoImage;

const isLoggingIn = ref(false);
const errorMessage = ref("");
const webauthnStep = ref<"idle" | "asserting" | "done">("idle");
const webauthnUnsupported = ref(false);

// Passkey-setup state — used when a new user has no passkeys yet.
// tryLoginWithOidcSession pauses here until the user registers one.
const needsPasskeySetup = ref(false);
const isRegisteringPasskey = ref(false);
const passkeySetupAccountId = ref("");
let _passkeySetupResolve: (() => void) | null = null;

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
 * Register a new passkey then immediately re-assert with PRF to derive the AES key.
 * Called from the passkey-setup panel that appears for first-time users.
 */
async function registerAndAssert(accountId: string) {
    isRegisteringPasskey.value = true;
    errorMessage.value = "";
    try {
        const beginRes = await $fetch("/wallet-api/auth/webauthn/register/begin", {
            method: "POST",
            // Force platform authenticator (Touch ID / Windows Hello) so the native OS
            // passkey manager handles it — browser-extension managers may intercept the
            // generic request but do not forward PRF extensions to the authenticator.
            body: {accountId, attachment: "platform"},
        });

        // IMPORTANT: @github/webauthn-json/browser-ponyfill's parse*FromJSON schema only
        // knows appid/appidExclude/credProps — it silently DROPS `prf`. Attach PRF on the
        // native options AFTER parsing, before navigator.credentials.create().
        const createOpts = parseCreationOptionsFromJSON({publicKey: beginRes as any});
        const prfActivationSalt = new Uint8Array(32); // throwaway activation salt
        createOpts.publicKey!.extensions = {
            ...(createOpts.publicKey!.extensions ?? {}),
            prf: {eval: {first: prfActivationSalt}},
        };

        const credential = await webauthnCreate(createOpts);
        const regExt = credential.getClientExtensionResults() as {
            prf?: {enabled?: boolean; results?: {first?: ArrayBuffer}};
        };
        console.info("[register] prf clientExtensionResults:",
            JSON.stringify(regExt.prf ?? null,
                (_k, v) => v instanceof ArrayBuffer ? `<AB ${v.byteLength}b>` : v));

        // toJSON() also strips PRF from clientExtensionResults — re-attach enabled flag.
        const regJSON = credential.toJSON();
        await $fetch("/wallet-api/auth/webauthn/register/finish", {
            method: "POST",
            body: {
                ...regJSON,
                clientExtensionResults: {
                    ...(regJSON.clientExtensionResults ?? {}),
                    prf: regExt.prf ? {enabled: regExt.prf.enabled === true || !!regExt.prf.results} : undefined,
                },
            },
        });

        // Passkey is registered — now assert with PRF to derive the AES key.
        needsPasskeySetup.value = false;
        await assertWebAuthn(accountId);

        // Resume the suspended tryLoginWithOidcSession.
        _passkeySetupResolve?.();
        _passkeySetupResolve = null;
    } catch (err) {
        console.error("[passkey] Registration failed:", err);
        errorMessage.value = "Passkey registration failed — please try again.";
    } finally {
        isRegisteringPasskey.value = false;
    }
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
            // New user — no passkeys registered yet.
            // Signal the login flow to pause and show the passkey-registration panel.
            needsPasskeySetup.value = true;
            passkeySetupAccountId.value = accountId;
            webauthnStep.value = "idle";
            return true;
        }

        // Load (or create) the per-account APP_SALT for PRF domain separation
        const appSalt = await getOrCreateAppSalt(accountId);

        // Parse standard fields, then attach PRF on the native options.
        // parseRequestOptionsFromJSON silently drops `prf` (not in its schema).
        const getOpts = parseRequestOptionsFromJSON({publicKey: beginRes as any});
        getOpts.publicKey!.extensions = {
            ...(getOpts.publicKey!.extensions ?? {}),
            prf: {eval: {first: appSalt}},
        };

        const assertion = await webauthnGet(getOpts);

        // --- PRF key derivation (stays entirely in browser) ---
        // Must use getClientExtensionResults() — the property is not always present.
        const authExt = assertion.getClientExtensionResults() as {
            prf?: {results?: {first?: ArrayBuffer}};
        };
        const prfFirst = authExt.prf?.results?.first;
        const prfBytes: Uint8Array | null = prfFirst ? new Uint8Array(prfFirst) : null;
        console.info("[PRF] clientExtensionResults.prf =",
            JSON.stringify(authExt.prf ?? null, (_k, v) =>
                v instanceof ArrayBuffer ? `<ArrayBuffer ${v.byteLength}b>` : v));
        console.info("[PRF] prfBytes present:", !!prfBytes);
        if (prfBytes) {
            try {
                const aesKey = await derivePrfKey(prfBytes, appSalt);
                useSecurityStore().setKey(aesKey, accountId);

                // Attempt to load and decrypt the stored SECDSA PIN blob for this account.
                // Silently skipped on first login (no blob yet) or if decryption fails.
                try {
                    const pinBlobRes = await $fetch<{blob: {iv: string; ct: string} | null}>(
                        `/wallet-api/auth/webauthn/wsca-pin?accountId=${encodeURIComponent(accountId)}`,
                    );
                    if (pinBlobRes?.blob) {
                        const pin = await decryptPin(aesKey, pinBlobRes.blob);
                        useSecurityStore().setSecdsaPin(pin, accountId);
                        console.info("[PRF] WSCA PIN restored — modal will be skipped this session");
                    }
                } catch (e) {
                    console.warn("[PRF] Could not restore WSCA PIN:", e);
                }
            } catch (e) {
                console.warn("[webauthn] PRF key derivation failed", e);
            }
        }

        // Strip PRF output before sending to server — it must not leave the browser.
        // Use toJSON() from browser-ponyfill which properly serialises all fields.
        const assertionJSON = assertion.toJSON();
        const assertionForServer = {
            ...assertionJSON,
            clientExtensionResults: {
                ...(assertionJSON.clientExtensionResults ?? {}),
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

        // If no passkeys were registered, the login flow is paused here until the
        // user completes passkey registration via registerAndAssert().
        if (needsPasskeySetup.value) {
            await new Promise<void>(r => { _passkeySetupResolve = r; });
        }

        // Step 3b: If a PRF key was derived during the assertion, try to load
        // the stored encrypted PIN for this session.  On success the PIN is
        // cached in Pinia and ensureWscaInitialized / ensureUnlocked will run
        // silently — no PIN modal for returning users.
        if (session.wscaAccountId) {
            const securityStore = useSecurityStore();
            const walletId = session.walletIds?.[0] ?? null;
            if (securityStore.prfKey && walletId) {
                try {
                    const res = await $fetch<{blob: {iv: string; ct: string} | null}>(
                        `/wallet-api/auth/webauthn/wsca-pin?accountId=${encodeURIComponent(session.wscaAccountId)}`,
                    );
                    if (res.blob) {
                        const pin = await decryptPin(securityStore.prfKey, res.blob);
                        securityStore.setSecdsaPin(pin, session.wscaAccountId);
                    }
                } catch {
                    // No stored blob yet (first login) or wrong passkey — user will
                    // be prompted during ensureWscaInitialized and the PIN will then
                    // be encrypted and persisted for next time.
                }
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
