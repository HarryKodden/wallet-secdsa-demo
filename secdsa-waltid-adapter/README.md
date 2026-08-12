# secdsa-waltid-adapter

> **Vendored into [wallet-secdsa-demo](../).** See [VENDOR.md](VENDOR.md).
> Prefer editing this tree in the demo repo; do not rely on a sibling checkout.

Bridge between [walt.id](https://github.com/walt-id/waltid-identity) crypto `Key` APIs and the
[HarryKodden/SECDSA](https://github.com/HarryKodden/SECDSA) **trust layer** (WSCA + SoftHSM).

```text
walt.id Wallet API / OID4VCI
        │  Key.signJws / generate
        ▼
secdsa-waltid-adapter   ← this project
        │  HTTPS
        ▼
HarryKodden/SECDSA  (cmd/wsca or lab /v1)
        │
        ▼
SoftHSM / memory WSCD
```

## Status

**Phase 1 in progress.** `SECDSAKey` subclasses walt.id `id.walt.crypto.keys.Key` and registers as backend `secdsa` on `KeyManager`. Interim lab HTTP still works (GENKEY via `userPub`, SIGN via `/api/judge/package` full Tr hex). Stable `/v1` in SECDSA remains the clean Path.

Plan: [docs/WALTID_ADAPTER_PLAN.md](docs/WALTID_ADAPTER_PLAN.md) · cheat-sheet: [docs/ADAPTER.md](docs/ADAPTER.md) ·
Wallet API wiring: [docs/WALTID_WALLET_API.md](docs/WALTID_WALLET_API.md).

## Usage (educational)

> **Not for production.** SECDSA is patent-encumbered. This adapter does **not** grant patent rights.
> Read [HarryKodden/SECDSA USAGE.md](https://github.com/HarryKodden/SECDSA/blob/main/USAGE.md) and NOTICE.

## Layout

| Path | Role |
|------|------|
| `src/main/kotlin/.../client` | HTTP client for the SECDSA WSCA API |
| `src/main/kotlin/.../key` | `SECDSAKey` — walt.id-shaped key handle (remote sign) |
| `src/main/kotlin/.../config` | Base URL, account id, unlock PIN session |
| `docs/WALTID_ADAPTER_PLAN.md` | Full integration plan |
| `docs/ADAPTER.md` | Method mapping cheat-sheet |

## Prerequisites

- JDK 17+ (project includes optional `.jdk/` for local Temurin 17; not committed)
- Running SECDSA trust layer (`WSCA_BASE_URL`), **or** Docker Compose (below)

```bash
cd ~/Projects/secdsa-waltid-adapter
export JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home 2>/dev/null)}"
# if needed: export JAVA_HOME="$PWD/.jdk/jdk-17.0.20+8/Contents/Home"
./gradlew test
./gradlew run --args='424242'   # needs lab on :8080
```

## Docker / Compose

Builds the adapter image (runs `./gradlew test installDist`) and optionally the SECDSA lab
from a sibling clone (`../wsca` by default, override with `SECDSA_PATH`).

```bash
# Lab UI only → http://localhost:8080
docker compose up --build lab

# One-shot adapter demo (activate/GENKEY/SIGN against the lab)
docker compose --profile demo run --rm --build adapter
```

| Variable | Meaning |
|----------|---------|
| `SECDSA_PATH` | Path to HarryKodden/SECDSA checkout (default `../wsca`) |
| `WSCA_PORT` | Host port for the lab UI (default `8080`) |
| `WSCA_ACCOUNT_ID` / `WSCA_PIN` | Demo account (lab only) |

See [`.env.example`](.env.example). Compose sets `WSCA_BASE_URL=http://lab:8080` on the adapter — do not point it at localhost in `.env`. Lab image uses the **memory** WSCD (SoftHSM is not bundled).

### walt.id app (separate compose)

This Compose file does **not** start walt.id. To run the Wallet / Issuer / Verifier stack and (later) plug in `backend: "secdsa"`:

→ **[docs/WALTID_WALLET_API.md](docs/WALTID_WALLET_API.md)**

```bash
# 1) SECDSA lab (this repo)
docker compose up --build lab

# 2) walt.id with SECDSA backend (sibling clone, branch secdsa-wallet-api-poc)
#    See docs/WALTID_WALLET_API.md — compile already verified; build image:
cd ~/Projects/waltid-identity
# set docker-compose/.env VERSION_TAG=1.0.0-SNAPSHOT
./gradlew :waltid-services:waltid-wallet-api:jibDockerBuild
cd docker-compose && docker compose up
```

## Config (env) — host / Gradle only

When running the adapter on the host against a lab on the machine (Compose lab or `go run ./cmd/lab`):

| Variable | Meaning |
|----------|---------|
| `WSCA_BASE_URL` | e.g. `http://127.0.0.1:8080` (not used by the Compose adapter service) |
| `WSCA_ACCOUNT_ID` | e.g. `citizen-42` |
| `WSCA_PIN` | Demo unlock PIN (lab only) |

## Related

- Trust layer only: [HarryKodden/SECDSA](https://github.com/HarryKodden/SECDSA) (`~/Projects/wsca`)
- walt.id: [waltid-identity](https://github.com/walt-id/waltid-identity)
