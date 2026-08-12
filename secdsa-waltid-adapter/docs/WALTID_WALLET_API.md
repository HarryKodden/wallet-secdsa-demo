# walt.id Wallet API ↔ SECDSA adapter

Educational wiring only. SECDSA is patent-encumbered — see
[USAGE.md](https://github.com/HarryKodden/SECDSA/blob/main/USAGE.md).

## Two stacks (keep them separate)

| Stack | What it is | How to run |
|-------|------------|------------|
| **This repo** | SECDSA lab + adapter library / demo CLI | `docker compose up --build lab` |
| **walt.id** | Wallet / Issuer / Verifier APIs + web apps | clone `waltid-identity`, `cd docker-compose && docker compose up` |

Compose in *this* repo does **not** start walt.id. The adapter is a Kotlin
`Key` backend (`backend: "secdsa"`), the same shape as AWS / TSE / Azure.

```text
Browser / curl
    │
    ▼
walt.id Wallet API  (:7001 via caddy, or published port)
    │  KeyManager.createKey(backend=secdsa)
    │  Key.signJws / signRaw
    ▼
secdsa-waltid-adapter  (on Wallet API classpath)
    │  HTTP
    ▼
SECDSA lab  (http://lab:8080 or host :8080)
```

## A. Run the walt.id app (stock keys)

```bash
git clone https://github.com/walt-id/waltid-identity.git
cd waltid-identity/docker-compose
docker compose pull
docker compose up
```

Typical URLs (see that repo’s `.env` / Caddyfile for exact ports):

| App / API | Approx. URL |
|-----------|-------------|
| Wallet API | http://localhost:7001/ |
| Issuer API | http://localhost:7002/ |
| Verifier API | http://localhost:7003/ |
| Web portal / demo wallet | see docker-compose README |

Stock Wallet API only knows `jwk`, `tse`, `aws`, `aws-rest-api`, `oci`, `azure`, …
It will **reject** `backend: "secdsa"` until the adapter is on the classpath (section B).

Keep the SECDSA lab up in parallel:

```bash
cd ~/Projects/secdsa-waltid-adapter
docker compose up --build lab
# UI → http://localhost:8080
```

From a walt.id container, the lab is often reachable as
`http://host.docker.internal:8080` (Docker Desktop) or via a shared compose network.

## B. Plug SECDSA into Wallet API (custom build)

### PoC already applied (sibling clone)

If you have:

```text
~/Projects/waltid-identity/          # branch secdsa-wallet-api-poc
~/Projects/secdsa-waltid-adapter/
~/Projects/wsca/                     # SECDSA lab
```

the Wallet API PoC is wired as:

| Change | Where |
|--------|--------|
| Module `waltid-crypto-secdsa` | compiles this adapter’s sources against monorepo `waltid-crypto` |
| `implementation(project(...waltid-crypto-secdsa))` | `waltid-wallet-api/build.gradle.kts` |
| `WaltCryptoSecdsa.init()` | `waltid-wallet-api/.../Main.kt` (next to AWS/OCI/Azure) |
| Commented `backend: secdsa` example | `docker-compose/wallet-api/config/registration-defaults.conf` |

Verify / recompile:

```bash
cd ~/Projects/secdsa-waltid-adapter
./scripts/verify-waltid-secdsa-patch.sh
```

Build a local Wallet API image (needs a running Docker daemon + pull access for
`eclipse-temurin:21-jre`):

```bash
cd ~/Projects/waltid-identity
# in docker-compose/.env set: VERSION_TAG=1.0.0-SNAPSHOT
# COMPOSE_PROFILES=identity-old   # classic wallet-api (this PoC), not wallet-api2
./gradlew :waltid-services:waltid-wallet-api:jibDockerBuild
cd docker-compose && docker compose up
```

### Local smoke (no Docker image) — verified

With SECDSA lab on `:8080` and this PoC branch compiled:

```bash
cd ~/Projects/waltid-identity
./gradlew :waltid-services:waltid-wallet-api:run \
  -PsecdsaAdapterPath=$HOME/Projects/secdsa-waltid-adapter
# → http://127.0.0.1:7001  (sqlite under waltid-wallet-api/data/)
```

Then:

```bash
# register + login + generate (or use scripts/smoke-wallet-secdsa.sh after setting TOKEN/WALLET_ID)
curl -sS -X POST http://127.0.0.1:7001/wallet-api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"type":"email","name":"SECDSA Demo","email":"secdsa-demo@example.com","password":"password123"}'

# login → token + GET /wallet-api/wallet/accounts/wallets → WALLET_ID
# POST .../keys/generate with backend secdsa (see below)
```

**Smoke result (2026-07-31):** `POST .../keys/generate` → `201` `secdsa:citizen-42:6`;
export public JWK OK; `POST .../keys/.../sign` → `200` compact JWS; lab `walletSN` advanced with SIGN.

Keep the SECDSA lab up (`docker compose up lab` in the adapter repo, or host lab). From Wallet API **containers** use
`http://host.docker.internal:8080` as `config.baseUrl`; from a **host** Wallet API process use `http://127.0.0.1:8080`.

Override adapter path if needed: `-PsecdsaAdapterPath=/path/to/secdsa-waltid-adapter`.

### Manual wiring (same as upstream KMS modules)

Upstream registers KMS backends at startup, e.g. in
`waltid-wallet-api/.../Main.kt`:

```kotlin
WaltCryptoOci.init()
WaltCryptoAws.init()
WaltCryptoAzure.init()
WaltCryptoSecdsa.init()  // ← add
```

### PIN / config

walt.id has no built-in PIN UX in the stock wallet. Prefer the educational clone
`waltid-web-wallet-secdsa`, which prompts before receive / present / generate and
calls:

`POST /wallet-api/wallet/{walletId}/keys/secdsa/unlock` `{ "accountId", "pin" }`

That stores the PIN in process memory (`SecdsaPinSession`) for subsequent WSCA calls.
Never log the PIN. Do not bake `pin` into `registration-defaults.conf` for real wallets.
Lab bootstrap only: `WSCA_PIN` on the Wallet API container.

### Generate a SECDSA key via Wallet API

After login / wallet creation (see walt.id [30‑min tutorial](https://docs.walt.id/community-stack/home/tutorial-30-min)):

```bash
curl -sS -X POST \
  "http://localhost:7001/wallet-api/wallet/${WALLET_ID}/keys/generate" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "backend": "secdsa",
    "keyType": "secp256r1",
    "config": {
      "baseUrl": "http://host.docker.internal:8080",
      "accountId": "citizen-42",
      "pin": "424242"
    }
  }'
```

Expected: HTTP 201 with a key id; lab timeline shows GENKEY; `GET .../keys/{id}/export` returns **public** JWK only.

Optional registration default (custom Wallet API config), same idea as TSE in
[registration-defaults](https://docs.walt.id/community-stack/wallet/configurations/config-files/registration-defaults):

```hocon
defaultKeyConfig: {
    backend: secdsa
    keyType: secp256r1
    config: {
        baseUrl: "http://host.docker.internal:8080"
        accountId: "citizen-42"
        pin: "424242"
    }
}
```

## C. Smoke without a patched Wallet API

This repo’s adapter CLI still proves SoftHSM sign/verify:

```bash
docker compose --profile demo run --rm --build adapter
# or on the host:
./gradlew run --args='424242'
```

Helper script (once you have a patched Wallet API + token):  
[`scripts/smoke-wallet-secdsa.sh`](../scripts/smoke-wallet-secdsa.sh)

## D. Later (Phase 3)

OID4VCI proof-of-possession: Wallet API `signJws` → adapter → lab SIGN.
True ES256 (hash-then-sign without double SHA-256) needs SECDSA Phase 0
“sign this digest” mode on `/v1`.

## Checklist

- [ ] Lab up (`:8080`), account activated with known PIN  
- [ ] walt.id compose up (stock UI/API exploration)  
- [ ] Custom Wallet API image with adapter jar + `WaltCryptoSecdsa.init()`  
- [ ] `POST .../keys/generate` with `backend: secdsa`  
- [ ] Export public JWK; confirm GENKEY in lab UI  
- [ ] (later) OID4VCI offer → PoP via SECDSA SIGN  
