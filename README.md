# walt.id + SECDSA demo stack

[![CI](https://github.com/HarryKodden/wallet-secdsa-demo/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/HarryKodden/wallet-secdsa-demo/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/HarryKodden/wallet-secdsa-demo?label=release)](https://github.com/HarryKodden/wallet-secdsa-demo/releases/latest)
[![GHCR web-wallet](https://img.shields.io/badge/ghcr.io-web--wallet-blue?logo=docker)](https://github.com/HarryKodden/wallet-secdsa-demo/pkgs/container/wallet-secdsa-demo%2Fweb-wallet)
[![GHCR wallet-api2](https://img.shields.io/badge/ghcr.io-wallet--api2-blue?logo=docker)](https://github.com/HarryKodden/wallet-secdsa-demo/pkgs/container/wallet-secdsa-demo%2Fwallet-api2)
[![GHCR issuer-api2](https://img.shields.io/badge/ghcr.io-issuer--api2-blue?logo=docker)](https://github.com/HarryKodden/wallet-secdsa-demo/pkgs/container/wallet-secdsa-demo%2Fissuer-api2)
[![GHCR verifier-api2](https://img.shields.io/badge/ghcr.io-verifier--api2-blue?logo=docker)](https://github.com/HarryKodden/wallet-secdsa-demo/pkgs/container/wallet-secdsa-demo%2Fverifier-api2)

Self-contained Docker Compose demo:

- **SECDSA** key lab (memory WSCD — educational)
- **wallet-api2** (OID4VC 1.0) with the SECDSA key backend
- **Web wallet** (Nuxt) using the wallet-api2 API surface + PIN unlock UX
- **issuer-api2** / **verifier-api2** for issue / present flows
- **Postgres** persistence for wallets, keys, credentials, events

> **Educational / PoC only — not production-ready.**
> Built on [walt.id](https://walt.id) open-source identity components
> ([waltid-identity](https://github.com/walt-id/waltid-identity), Apache-2.0)
> via the private SECDSA mirror
> ([HarryKodden/waltid-identity-secdsa](https://github.com/HarryKodden/waltid-identity-secdsa))
> plus the patent-encumbered [SECDSA](https://github.com/HarryKodden/SECDSA)
> lab — see [USAGE.md](https://github.com/HarryKodden/SECDSA/blob/main/USAGE.md)
> and [NOTICE](NOTICE). This repo’s glue is Apache-2.0 ([LICENSE](LICENSE)),
> subject to third-party terms in NOTICE.

### Security posture (read before publishing or exposing ports)

| Topic | PoC default |
|-------|-------------|
| wallet-api2 API auth | **Enabled** — JWT accounts; wallets are private to the logged-in account |
| Issuer / verifier / wallet JWT keys | **Demo EC private JWKs** in config — rotate before any shared deploy |
| Lab SoftHSM | OIDC users: WSCA account id = OIDC `sub`; first login sets a **6-digit PIN**. Email/lab fallback: `citizen-42` / `424242` |
| Wallet / credential data | **Postgres** volume `postgres-data` (survives restart) |
| Auth accounts (email/password) | File volume `wallet-api2-accounts` (`WALLET2_ACCOUNT_STORE_PATH`) |
| SECDSA keys | Memory WSCD in `secdsa` — **not** durable across secdsa restart |
| Secrets | Copy [`.env.example`](.env.example) → `.env`; never commit `.env` |
| Binary build | `*/api2/dist/` is **not** in git — build with `./scripts/build-api2.sh` (wallet locally; CI builds all three) |

Keep published ports on localhost. Rotate demo keys before any non-local use.
Avoid `docker compose down -v` unless you intend to wipe Postgres and accounts.
After restarting only `secdsa`, regenerate keys/DIDs (lab WSCD is in-memory).

## Quick start

> If `~/Projects/waltid-identity/docker-compose` is already running, either stop it
> (`docker compose down` there) **or** change the `*_HOST_PORT` values in `.env`
> (e.g. `WEB_WALLET_HOST_PORT=8115`, `WALLET_API2_HOST_PORT=8006`, `SECDSA_HOST_PORT=28080`).

```bash
cd ~/Projects/wallet-secdsa-demo

cp .env.example .env   # fill OIDC_* if you use login

# Required once (needs sibling repos — see below)
./scripts/build-wallet-api2.sh

./scripts/up.sh
# or: docker compose up --build -d
```

| Service | URL |
|---------|-----|
| Web wallet (PIN UX) | http://localhost:7115 |
| Wallet API2 Swagger | http://localhost:7006/swagger |
| Issuer API2 Swagger | http://localhost:7005/swagger |
| Verifier API2 Swagger | http://localhost:7004/swagger |
| SECDSA lab UI | http://localhost:18080 |

**OIDC:** SoftHSM account = your IdP `sub`; choose a 6-digit PIN on first sign-in.

**Email/lab fallback:** account `citizen-42` · PIN `424242`

## Requesting credentials (authenticated users)

Wallet-api2 auth is on: register or sign in first (email/password or OIDC), then open or
create a wallet. Before the first receive/present, generate a SECDSA key and a `did:jwk`
from it (Settings → Keys / DIDs). After OIDC login, new users set a 6-digit PIN to
initialise WSCA; later operations re-prompt for that PIN when unlocking SoftHSM.

To **receive** a credential (OID4VCI):

1. Open **Scan** in the web wallet (http://localhost:7115).
2. Paste a credential-offer URL, upload a QR screenshot, or scan the QR from a second device
   (the camera cannot read a QR shown on the same screen).
3. Review the offer, pick your `did:jwk`, then continue based on the grant:

| Grant | What happens |
|-------|----------------|
| **pre-authorized_code** | Enter SECDSA PIN → **Accept** → credential stored (one-shot). |
| **authorization_code** | **Continue at issuer** → sign in at the issuer AS → redirect to `/oid4vci/callback` → PIN → proof → store. |

OAuth `state` (CSRF) is stored in the browser across the AS redirect; OID4VCI `issuer_state`
from the offer is forwarded by wallet-api2 when building the authorization URL.

Configure the OID4VCI public client in `.env` (separate from wallet **login** OIDC):

```bash
OID4VCI_CLIENT_ID=wallet-secdsa-demo
OID4VCI_REDIRECT_URI=http://localhost:7115/oid4vci/callback
```

Register that `redirect_uri` and client id at the credential issuer’s authorization server.
For **as.dev.eduid.nl**, allow at least scope **`openid`** on the client (optionally `profile`,
`email`, or eduID scopes such as `eduid.nl/eduid`). Do **not** use `wallet:read` /
`wallet:write` / `api:read` — those are unrelated demo scopes; OID4VCI names the credential
via `authorization_details`, not those scopes.

To **present** a credential (OID4VP), open or scan a presentation request the same way.

### Local lab (issuer-api2 / verifier-api2)

On **Scan**, the **Local lab** strip is shown only when the corresponding internal
URLs are set (`ISSUER_API2_INTERNAL_URL` / `VERIFIER_API2_INTERNAL_URL`). Local
`docker compose` injects those by default; omit them (e.g. in `deploy/`) to hide
the panels. Proxies are server-side only (no browser CORS):

| Action | What it does |
|--------|----------------|
| **Get credential** | Pre-authorized offer from issuer-api2 → normal issuance flow |
| **Present to verifier** | DCQL request matching a credential **already in this wallet** → present flow |

Lab issue defaults to **pre-authorized**. Authorization-code needs a user-login AS
for issuer-api2 (not the same as wallet login OIDC):

```bash
# Issuer’s confidential client at your IdP (Keycloak, etc.)
ISSUER_AS_AUTHORIZE_URL=https://keycloak.example/realms/demo/protocol/openid-connect/auth
ISSUER_AS_TOKEN_URL=https://keycloak.example/realms/demo/protocol/openid-connect/token
ISSUER_AS_CLIENT_ID=issuer_api
ISSUER_AS_CLIENT_SECRET=...
LAB_ENABLE_AUTH_CODE=true

# Wallet’s public OID4VCI client (already used for sandbox auth-code)
OID4VCI_CLIENT_ID=wallet-secdsa-demo
OID4VCI_REDIRECT_URI=http://localhost:7115/oid4vci/callback
```

Then `docker compose up -d --force-recreate issuer-api2 web-wallet`. Without that, use
the [eduWallet sandbox](https://sandbox.dev.eduwallet.nl/) for auth-code demos.

Offer URLs may use `host.docker.internal` so wallet-api2 can fetch them inside Compose.
The web wallet rewrites the browser authorize URL to `localhost`, and Caddy rewrites
`Location` redirects the same way, so the flow can reach
`/external_login` → your `ISSUER_AS_*` IdP. Register the issuer OAuth callback as
`http://localhost:7005/openid4vci/external/oauth/callback` on that AS.
Swagger remains at http://localhost:7005 / http://localhost:7004.

### Dev issuer: eduWallet sandbox

For end-to-end testing against an external issuer (eduID-style auth-code, etc.):

**[https://sandbox.dev.eduwallet.nl/](https://sandbox.dev.eduwallet.nl/)**

(also linked from the Lab panel)

- Pre-authorized and authorization-code issuance
- eduID / eduPerson / Academic Base / Generic / PID style credentials
- Optional PIN on issuance, expiry, and revoke scenarios
- Matching verify actions for some credential types

Pick an issue action on the sandbox page, then bring the resulting offer (QR or URL) into
this demo’s **Scan** flow as an authenticated user.

- **Pre-authorized** cards → Accept in the wallet (single-use codes — request a fresh offer if retrying).
- **Authorization-code** cards (e.g. eduID) → Continue at issuer; ensure the sandbox AS allows
  `OID4VCI_CLIENT_ID` / `OID4VCI_REDIRECT_URI` (or point those env vars at a client the sandbox already knows).

## Layout

```text
wallet-secdsa-demo/
├── docker-compose.yml      # full stack
├── Caddyfile               # publishes API + wallet ports
├── .env.example            # template — copy to .env
├── LICENSE / NOTICE
├── scripts/
│   ├── build-api2.sh           # wallet / issuer / verifier installDist
│   ├── build-wallet-api2.sh    # wrapper → wallet only
│   ├── build-issuer-api2.sh
│   ├── build-verifier-api2.sh
│   ├── create-release.sh       # tag + GitHub release → GHCR :<tag>
│   └── up.sh
├── wallet-api2/            # Dockerfile + config; dist/ built locally
├── issuer-api2/            # Dockerfile + config; dist/ from CI / build-api2
├── verifier-api2/          # Dockerfile + config; dist/ from CI / build-api2
└── web-wallet/             # Nuxt SECDSA PIN wallet → wallet-api2
```

## How the pieces connect

```text
Browser :7115
  └─ web-wallet
        ├─ /wallet-api/** ──► wallet-api2 :7006 ── Postgres + SECDSA
        └─ /api/lab/**    ──► issuer-api2 :7005 / verifier-api2 :7004
                              (server-only; OID4VCI/VP URLs still go via wallet-api2)
```

- Keys are generated with `backend: "secdsa"` and `config.baseUrl: http://secdsa:8080`
- Before GENKEY / SIGN the web wallet prompts for the PIN and calls
  `POST /wallet/{id}/keys/secdsa/unlock`

## Building api2 images

Stock `waltid/wallet-api2` images do **not** include the SECDSA backend. Locally
this demo builds `wallet-api2` from `wallet-api2/dist` (gitignored).

Issuer/verifier can stay on Docker Hub (`waltid/*:stable`) for a quick lab start,
or use the same `installDist` + Dockerfile path (and GHCR images from CI).

`./scripts/build-api2.sh` expects:

| Env | Default |
|-----|---------|
| `WALTID_IDENTITY_PATH` | `~/Projects/waltid-identity` (use the private [waltid-identity-secdsa](https://github.com/HarryKodden/waltid-identity-secdsa) checkout) |
| `SECDSA_ADAPTER_PATH` | `~/Projects/secdsa-waltid-adapter` |
| `JAVA_HOME` | Homebrew OpenJDK if present |

CI builds **wallet-api2**, **issuer-api2**, and **verifier-api2** from the private deps
([waltid-identity-secdsa](https://github.com/HarryKodden/waltid-identity-secdsa),
[secdsa-waltid-adapter](https://github.com/HarryKodden/secdsa-waltid-adapter)).
Add repository secret `DEPENDENCY_TOKEN` — a fine-grained PAT with **Contents: Read**
on both private repos (`GITHUB_TOKEN` cannot clone sibling private repositories).

Optional branch overrides (repository variables): `WALTID_IDENTITY_REF`, `SECDSA_ADAPTER_REF`
(default `main`).

```bash
./scripts/build-wallet-api2.sh          # or: ./scripts/build-api2.sh wallet
docker compose build wallet-api2

# Optional local issuer/verifier (same fork as CI):
./scripts/build-api2.sh issuer verifier
docker build -t wallet-secdsa-demo/issuer-api2:local ./issuer-api2
docker build -t wallet-secdsa-demo/verifier-api2:local ./verifier-api2
```

## Releases & GHCR images

CI publishes multi-arch images to GHCR. On every push to `main`: `:latest` and `:sha-<commit>`.
On a version tag (`v*`) the same images are also tagged with the release (e.g. `:v0.1.0`).

| Image | Pull |
|-------|------|
| Web wallet | `ghcr.io/harrykodden/wallet-secdsa-demo/web-wallet:<tag>` |
| wallet-api2 (SECDSA) | `ghcr.io/harrykodden/wallet-secdsa-demo/wallet-api2:<tag>` |
| issuer-api2 | `ghcr.io/harrykodden/wallet-secdsa-demo/issuer-api2:<tag>` |
| verifier-api2 | `ghcr.io/harrykodden/wallet-secdsa-demo/verifier-api2:<tag>` |

### Public deploy (external reverse proxy)

Use [`deploy/`](deploy/) — GHCR images only, no local build, TLS left to your proxy:

```bash
cd deploy
cp .env.example .env   # set VERSION_TAG, public HTTPS URLs, DB_PASSWORD, …
docker compose pull && docker compose up -d
```

Upstreams bind to `127.0.0.1:7004–7115` by default; point the proxy at those ports.

Create a release (suggests the next patch tag; confirm or edit):

```bash
./scripts/create-release.sh
# or: ./scripts/create-release.sh v0.2.0
```

The web wallet builds with `NUXT_PUBLIC_APP_VERSION` set to that tag and shows it on the
upper-right version ribbon.

## Web wallet only (host npm)

```bash
cd web-wallet
npm install
cd apps/waltid-dev-wallet
WALLET_API2_PROXY=http://127.0.0.1:7006 \
NUXT_PUBLIC_WSCA_BASE_URL=http://secdsa:8080 \
npm run dev
```

With the stack up, prefer the Dockerized wallet on :7115.

## Useful curls

```bash
# Create wallet
WID=$(curl -sS -X POST http://localhost:7006/wallet | python3 -c 'import sys,json;print(json.load(sys.stdin)["walletId"])')

# Unlock SECDSA account
curl -sS -X POST "http://localhost:7006/wallet/$WID/keys/secdsa/unlock" \
  -H 'Content-Type: application/json' \
  -d '{"accountId":"citizen-42","pin":"424242"}'

# Generate SECDSA key (secp256r1 / P-256)
curl -sS -X POST "http://localhost:7006/wallet/$WID/keys/generate" \
  -H 'Content-Type: application/json' \
  -d '{"backend":"secdsa","keyType":"secp256r1","config":{"baseUrl":"http://secdsa:8080","accountId":"citizen-42"}}'
```

## Tear down

```bash
docker compose down
# wipe DB + recreate lab (fresh memory WSCD):
docker compose down -v && docker compose up --build -d
```

## Notes

- The SECDSA image is **memory WSCD**, not SoftHSM-in-Docker; naming in the UI is educational.
- wallet-api2 **auth is enabled** (JWT). Email/password goes to `/auth/register` +
  `/auth/emailpass`. **OIDC** still starts in Nuxt; Nitro JIT-provisions a
  wallet-api2 account and stores the **wallet-api2** JWT in `auth.token`
  (set `OIDC_BRIDGE_SECRET` in `.env` for stable OIDC passwords across restarts
  of the *bridge*, not the API account store).
  Register redirect URI `http://localhost:7115/wallet-api/auth/oidc-session` and set
  `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` in `.env`.
- Compose defaults issuer/verifier to Docker Hub (`waltid/*:stable`). Point
  `ISSUER_API2_IMAGE` / `VERIFIER_API2_IMAGE` at the GHCR images above to run
  the same builds CI publishes.
- Upstream walt.id sources: [waltid-identity](https://github.com/walt-id/waltid-identity) (Apache-2.0).
