# wallet-api2 (SECDSA-enabled)

Standalone Gradle app: published walt.id **0.23.1** libs + in-repo
`secdsa-waltid-adapter` + small overlays (`Wallet2RouteHandler`, event log,
auth/PIN routes). **No waltid-identity checkout.**

## Build

```bash
./scripts/build-wallet-api2.sh   # → wallet-api2/dist
docker compose build wallet-api2
```

| Env | Default |
|-----|---------|
| `JAVA_HOME` | Homebrew OpenJDK / JDK 21+ |

## Layout

| Path | Role |
|------|------|
| `src/main/kotlin/id/walt/wallet2/` | App Main, auth, SECDSA unlock |
| `…/server/handlers/Wallet2RouteHandler.kt` | Overlay: `backend=secdsa` generate (Phase 2: SECDSA-only) |
| `…/server/events/Wallet2EventLog.kt` | Overlay: in-memory event log |
| `../secdsa-waltid-adapter/` | Compiled into this project |
| `config/` | Runtime HOCON (baked into image) |
| `dist/` | `installDist` output (gitignored) |

## Auth / ownership

- `config/_features.conf` enables **`auth`** and **`wallet2-persistence`**.
- Register / login: `POST /auth/register`, `POST /auth/emailpass`.
- Nuxt bridges OIDC → JIT wallet-api2 account (`OIDC_BRIDGE_SECRET`).
- Optional: `WALLET2_ACCOUNT_STORE_PATH` persists email/password accounts.

Holder HTTP contract: [docs/http-contract.md](../docs/http-contract.md).
Smoke: `./scripts/smoke-holder-contract.sh`.

## Issuer / verifier

Not built here. Use stock Docker Hub `waltid/issuer-api2` and
`waltid/verifier-api2` (see root `docker-compose.yml`).
