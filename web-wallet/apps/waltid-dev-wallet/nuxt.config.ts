import {defineNuxtConfig} from "nuxt/config";
import presetIcons from "@unocss/preset-icons";
import path from "path";

export default defineNuxtConfig({
    devtools: {enabled: true},
    srcDir: "src",
    // With srcDir: "src", Nuxt resolves server handlers under src/server (not ./server).
    serverDir: "src/server",

    devServer: {
        port: 7115,
    },

    modules: [
        "@vueuse/nuxt",
        ["@unocss/nuxt", {autoImport: false}],
        "@nuxtjs/i18n",
        "@nuxtjs/color-mode",
        "@vite-pwa/nuxt",
        "@sidebase/nuxt-auth",
        "@nuxt/content",
        "@pinia/nuxt",
        "nuxt-icon",
    ],

    build: {
        transpile: ["@headlessui/vue"],
    },

    auth: {
        baseURL: "/wallet-api/auth",

        provider: {
            type: "local",
            token: {
                // Classic wallet-api (:7001) auth — proxied for OIDC / email
                maxAgeInSeconds: 60 * 60 * 24 * 7,
                cookieName: 'auth.token',
                sameSiteAttribute: 'lax',
                signInResponseTokenPointer: "/token",
            },

            endpoints: {
                signIn: {path: '/login', method: 'post'},
                signOut: {path: '/logout', method: 'post'},
                signUp: {path: '/register', method: 'post'},
                getSession: {path: '/session', method: 'get'},
            },

            pages: {
                login: "/login",
            },
        },

        globalAppMiddleware: {
            // Enforce authenticated sessions for all protected routes.
            isEnabled: true,
        },
    },

    pwa: {
        registerWebManifestInRouteRules: true,

        srcDir: "public/sw",
        filename: "worker.js",

        strategies: "injectManifest",
        injectRegister: "script",
        injectManifest: {injectionPoint: undefined},
        registerType: "autoUpdate",
        // Automatically unregisters any stale ServiceWorker on next page load.
        // Prevents "InvalidStateError" after rebuilds that change content-hashed filenames.
        selfDestroying: true,
        // notification-worker.js
        manifest: {
            name: "walt.id wallet",
            short_name: "walt.id",
            display: "standalone",
            theme_color: "#0573f0",
            icons: [
                {
                    src: "/icons/android-icon-36x36.png",
                    sizes: "36x36",
                    type: "image/png",
                },
                {
                    src: "/icons/android-icon-48x48.png",
                    sizes: "48x48",
                    type: "image/png",
                },
                {
                    src: "/icons/android-icon-72x72.png",
                    sizes: "72x72",
                    type: "image/png",
                },
                {
                    src: "/icons/android-icon-96x96.png",
                    sizes: "96x96",
                    type: "image/png",
                },
                {
                    src: "/icons/android-icon-144x144.png",
                    sizes: "144x144",
                    type: "image/png",
                },
                {
                    src: "/icons/waltid-icon-192x192.png",
                    sizes: "192x192",
                    type: "image/png",
                },
                {
                    src: "/icons/waltid-icon-512x512.png",
                    sizes: "512x512",
                    type: "image/png",
                },
                {
                    src: "/icons/waltid-icon-512x512.png",
                    sizes: "512x512",
                    type: "image/png",
                    purpose: "any maskable",
                },
            ],
            shortcuts: [
                {
                    name: "Scan QR code",
                    short_name: "Scan QR",
                    url: "/wallet/scan-qr",
                    description:
                        "Scan a QR code to receive/present credentials from/to a service.",
                },
            ],
        },
        workbox: {
            navigateFallback: null,
            globPatterns: ["client/**/*.{js,css,ico,png,svg,webp,woff,woff2}"],
        },
        client: {
            installPrompt: true,
            // you don't need to include this: only for testing purposes
            // if enabling periodic sync for update use 1 hour or so (periodicSyncForUpdates: 3600)
            periodicSyncForUpdates: 20,
        },
        devOptions: {
            enabled: true,
            type: "module",
        },
    },

    unocss: {
        uno: false,
        preflight: false,
        icons: true,
        presets: [
            presetIcons({
                scale: 1.2,
                extraProperties: {
                    display: "inline-block",
                },
            }),
        ],
        safelist: ["i-twemoji-flag-us-outlying-islands", "i-twemoji-flag-turkey"],
    },

    typescript: {
        tsConfig: {
            compilerOptions: {
                strict: true,
                types: ["./type.d.ts"],
            },
        },
    },

    colorMode: {
        classSuffix: "",
        fallback: "light",
        storageKey: "color-mode",
    },

    vite: {
        logLevel: "info",
        resolve: {
            alias: {
                "@waltid-web-wallet": path.resolve(__dirname, "../../libs"),
            },
        },
        server: {
            allowedHosts: true
        }
        /*server: {
                proxy: {
                    '/api': {
                        target: 'http://localhost:4545'
                    }
                }
            }*/
    },

    runtimeConfig: {
        // Server-only — used by Nitro OIDC callback (never expose to the browser).
        oidcClientSecret: process.env.NUXT_OIDC_CLIENT_SECRET || process.env.OIDC_CLIENT_SECRET || "",
        oidcTokenUrl:
            process.env.NUXT_OIDC_TOKEN_URL ||
            process.env.NUXT_PUBLIC_OIDC_TOKEN_URL ||
            "https://oidc.pilot1.sram.surf.nl/token",
        walletApi2Proxy: process.env.WALLET_API2_PROXY || "http://wallet-api2:7006",
        // Server-only Lab proxies (browser never talks to issuer/verifier directly).
        // Empty = Lab UI/API disabled; local compose injects service DNS when present.
        issuerApi2InternalUrl: process.env.ISSUER_API2_INTERNAL_URL || "",
        verifierApi2InternalUrl: process.env.VERIFIER_API2_INTERNAL_URL || "",
        public: {
            projectId: process.env.ProjectId,
            // Release tag (e.g. v0.1.0) — shown as the corner ribbon; set at image build.
            // theme-version corner ribbon (local default DEV; release builds pass vX.Y.Z).
            appVersion: process.env.NUXT_PUBLIC_APP_VERSION || "DEV",
            issuerCallbackUrl: "http://localhost:7100",
            credentialsRepositoryUrl: "http://localhost:3000",
            demoWalletUrl: "https://wallet-dev.walt.id",
            oidcAuthorizeUrl: process.env.NUXT_PUBLIC_OIDC_AUTHORIZE_URL || "https://oidc.pilot1.sram.surf.nl/authorize",
            oidcClientId: process.env.NUXT_PUBLIC_OIDC_CLIENT_ID || process.env.OIDC_CLIENT_ID || "",
            // Must match the redirect URI registered at the IdP (classic wallet-api contract).
            oidcRedirectUri:
                process.env.NUXT_PUBLIC_OIDC_REDIRECT_URI ||
                "http://localhost:7115/wallet-api/auth/oidc-session",
            oidcPublicBaseUrl: process.env.NUXT_PUBLIC_OIDC_PUBLIC_BASE_URL || "http://localhost:7115",
            oidcScopes: process.env.NUXT_PUBLIC_OIDC_SCOPES || "openid email profile",
            // Inside compose, wallet-api2 reaches SECDSA as http://secdsa:8080
            wscaBaseUrl: process.env.NUXT_PUBLIC_WSCA_BASE_URL || "http://secdsa:8080",
            // OID4VCI authorization_code client (separate from wallet login OIDC)
            oid4vciClientId:
                process.env.NUXT_PUBLIC_OID4VCI_CLIENT_ID ||
                process.env.OID4VCI_CLIENT_ID ||
                "wallet-secdsa-demo",
            oid4vciRedirectUri:
                process.env.NUXT_PUBLIC_OID4VCI_REDIRECT_URI ||
                process.env.OID4VCI_REDIRECT_URI ||
                "http://localhost:7115/oid4vci/callback",
            // Issuer user-login AS (non-secret) — Lab auth-code UI; secret stays on issuer-api2
            issuerAsAuthorizeUrl: process.env.ISSUER_AS_AUTHORIZE_URL || "",
            issuerAsTokenUrl: process.env.ISSUER_AS_TOKEN_URL || "",
            issuerAsClientId: process.env.ISSUER_AS_CLIENT_ID || "",
            labEnableAuthCode: process.env.LAB_ENABLE_AUTH_CODE || "",
        },
    },

    nitro: {
        compressPublicAssets: {
            gzip: true,
            brotli: false,
        },
        // Wallet data APIs are proxied by src/server/routes/wallet-api/[...path].ts
        // (not routeRules) so /wallet-api/auth/** Nitro handlers are not swallowed.
    },

    // i18n: {
    //     lazy: true,
    //     langDir: 'locales',  // need `lang` dir on `admin`
    //     defaultLocale: "en-US",
    //     detectBrowserLanguage: false,
    //     locales: [
    //         {
    //             code: 'en',
    //             file: 'en-US.json',
    //         },
    //         {
    //             code: 'tr',
    //             file: 'tr-TR.json',
    //         },
    //     ]
    // }
    //proxy: [ 'http://localhost:4545/api' ]

    ssr: false,
    compatibilityDate: "2024-07-26",
});
