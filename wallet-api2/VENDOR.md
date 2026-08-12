# Vendored / overlay sources (Chapter F)

This directory is a **standalone** wallet-api2 build. It does not clone
`waltid-identity-secdsa`.

| Piece | Origin |
|-------|--------|
| App (`Main`, auth, `SecdsaUnlockRoutes`, …) | Adapted from private SECDSA mirror of walt.id wallet-api2 |
| `Wallet2RouteHandler` overlay | Fork patch: dynamic `KeyGenerationRequest` + demo routes; Phase 2 restricts generate to `backend=secdsa` |
| `Wallet2EventLog` | Fork patch (in-memory; stock 0.23.1 has no event log) |
| Libraries | Maven `id.walt.*:0.23.1` from `https://maven.waltid.dev/releases` |
| SECDSA crypto | `../secdsa-waltid-adapter` (compiled via `sourceSets`) |

walt.id code remains Apache-2.0; SECDSA terms apply separately (see root `NOTICE`).
