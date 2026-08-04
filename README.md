# walt.id + SECDSA demo stack

[![CI](https://github.com/HarryKodden/wallet-secdsa-demo/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/HarryKodden/wallet-secdsa-demo/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/HarryKodden/wallet-secdsa-demo?label=release)](https://github.com/HarryKodden/wallet-secdsa-demo/releases/latest)
[![GHCR web-wallet](https://img.shields.io/badge/ghcr.io-web--wallet-blue?logo=docker)](https://github.com/HarryKodden/wallet-secdsa-demo/pkgs/container/wallet-secdsa-demo%2Fweb-wallet)
[![GHCR wallet-api2](https://img.shields.io/badge/ghcr.io-wallet--api2-blue?logo=docker)](https://github.com/HarryKodden/wallet-secdsa-demo/pkgs/container/wallet-secdsa-demo%2Fwallet-api2)

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
| Lab account / PIN | `citizen-42` / `424242` — SoftHSM-style lab defaults only (SECDSA, not walt.id login) |
| Secrets | Copy [`.env.example`](.env.example) → `.env`; never commit `.env` |
| Binary build | `wallet-api2/dist/` is **not** in git — build with `./scripts/build-wallet-api2.sh` |
| Account store | In-memory in wallet-api2 — re-register after API restart |

Keep published ports on localhost. Rotate demo keys before any non-local use.
Accounts are in-memory in wallet-api2: after `docker compose restart wallet-api2`,
users must register/login again (new account id); prior wallet ownership links in
Postgres stay with the old account id.

## Quick start

> If `~/Projects/waltid-identity/docker-compose` is already running, either stop it
> (`docker compose down` there) **or** change the `*_HOST_PORT` values in `.env`
> (e.g. `WEB_WALLET_HOST_PORT=8115`, `WALLET_API2_HOST_PORT=8006`, `SECDSA_HOST_PORT=28080`).

```bash
cd ~/Projects/wallet-secdsa-demo

cp .env.example .env   # fill OIDC_* if you use SURF login

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

**Lab account:** `citizen-42` · **PIN:** `424242`

## Layout

```text
wallet-secdsa-demo/
├── docker-compose.yml      # full stack
├── Caddyfile               # publishes API + wallet ports
├── .env.example            # template — copy to .env
├── LICENSE / NOTICE
├── scripts/
│   ├── build-wallet-api2.sh
│   ├── create-release.sh   # tag + GitHub release → GHCR :<tag>
│   └── up.sh
├── wallet-api2/            # Dockerfile + config; dist/ built locally
├── issuer-api2/config/
├── verifier-api2/config/
└── web-wallet/             # Nuxt SECDSA PIN wallet → wallet-api2
```

## How the pieces connect

```text
Browser :7115
  └─ web-wallet  ──/wallet-api/**──►  wallet-api2 :7006
                                          │
                                          ├─ Postgres
                                          └─ SECDSA lab :8080 (compose DNS: secdsa)
Issuer :7005 / Verifier :7004  ◄── OID4VCI / OID4VP with the wallet
```

- Keys are generated with `backend: "secdsa"` and `config.baseUrl: http://secdsa:8080`
- Before GENKEY / SIGN the web wallet prompts for the PIN and calls
  `POST /wallet/{id}/keys/secdsa/unlock`

## Building wallet-api2 (SECDSA)

Stock `waltid/wallet-api2` images do **not** include the SECDSA backend. This
demo builds a local image from `wallet-api2/dist` (gitignored — not published).

`./scripts/build-wallet-api2.sh` expects:

| Env | Default |
|-----|---------|
| `WALTID_IDENTITY_PATH` | `~/Projects/waltid-identity` (use the private [waltid-identity-secdsa](https://github.com/HarryKodden/waltid-identity-secdsa) checkout) |
| `SECDSA_ADAPTER_PATH` | `~/Projects/secdsa-waltid-adapter` |
| `JAVA_HOME` | Homebrew OpenJDK if present |

CI always builds `wallet-api2` from the private deps
([waltid-identity-secdsa](https://github.com/HarryKodden/waltid-identity-secdsa),
[secdsa-waltid-adapter](https://github.com/HarryKodden/secdsa-waltid-adapter)).
Add repository secret `DEPENDENCY_TOKEN` — a fine-grained PAT with **Contents: Read**
on both private repos (`GITHUB_TOKEN` cannot clone sibling private repositories).

Optional branch overrides (repository variables): `WALTID_IDENTITY_REF`, `SECDSA_ADAPTER_REF`
(default `main`).

```bash
./scripts/build-wallet-api2.sh
docker compose build wallet-api2
```

## Releases & GHCR images

CI publishes multi-arch images to GHCR. On every push to `main`: `:latest` and `:sha-<commit>`.
On a version tag (`v*`) the same images are also tagged with the release (e.g. `:v0.1.0`).

| Image | Pull |
|-------|------|
| Web wallet | `ghcr.io/harrykodden/wallet-secdsa-demo/web-wallet:<tag>` |
| wallet-api2 (SECDSA) | `ghcr.io/harrykodden/wallet-secdsa-demo/wallet-api2:<tag>` |

Create a release (suggests the next patch tag; confirm or edit):

```bash
./scripts/create-release.sh
# or: ./scripts/create-release.sh v0.2.0
```

The web wallet builds with `NUXT_PUBLIC_APP_VERSION` set to that tag and shows it on the
upper-right SURF version ribbon.

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
  `/auth/emailpass`. **SURF OIDC** still starts in Nuxt; Nitro JIT-provisions a
  wallet-api2 account and stores the **wallet-api2** JWT in `auth.token`
  (set `OIDC_BRIDGE_SECRET` in `.env` for stable OIDC passwords across restarts
  of the *bridge*, not the API account store).
  Register redirect URI `http://localhost:7115/wallet-api/auth/oidc-session` and set
  `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` in `.env`.
- Issuer/verifier images are pulled from Docker Hub (`waltid/issuer-api2:stable`, `waltid/verifier-api2:stable`).
- Upstream walt.id sources: [waltid-identity](https://github.com/walt-id/waltid-identity) (Apache-2.0).
