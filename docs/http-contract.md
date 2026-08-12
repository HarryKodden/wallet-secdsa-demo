# Frozen HTTP contract (Chapter F Phase 0)

Surface used by the Nuxt web-wallet (and mobile via the same wallet-api2 JWT).
Changing these without a coordinated client update is a **breaking** change.

Base URLs (local compose):

| Surface | Base | Notes |
|---------|------|--------|
| Browser → Nitro | `/wallet-api/…` | Same-origin; Nitro proxies / implements |
| Nitro → wallet-api2 | `WALLET_API2_PROXY` (e.g. `http://wallet-api2:7006`) | Injects `Authorization: Bearer` from cookie |
| SoftHSM / WSCA | `NUXT_PUBLIC_WSCA_BASE_URL` / `http://secdsa:8080` | Unlock + adapter sign path |

Auth model (not IdP JWT on wallet-api2): OIDC → Nitro JIT `POST /auth/register` +
`POST /auth/emailpass` → cookie `auth.token` (wallet-api2 JWT).

---

## Smoke path (must keep green)

```text
OIDC / emailpass login
  → SoftHSM PIN unlock (setup if not activated)
  → SECDSA key generate (if missing)
  → did:jwk create (if missing)
  → credentials/receive (offer)
  → credentials/present (request)
```

Script (stack must be up): `./scripts/smoke-holder-contract.sh`

---

## Auth & session (Nitro and/or wallet-api2)

| Method | Path | Role |
|--------|------|------|
| GET | `/wallet-api/auth/oidc-login` | Start OIDC |
| GET | `/wallet-api/auth/oidc-token` | Exchange / read bridge token |
| GET | `/wallet-api/auth/session` | Session + `wscaAccountId` |
| POST | `/wallet-api/auth/logout` | Clear cookies |
| POST | `/auth/register` | wallet-api2 account (JIT) |
| POST | `/auth/emailpass` | wallet-api2 JWT |
| GET | `/auth/account` | Account + wallet ids (Bearer) |

WebAuthn / pairing (Nitro): `/wallet-api/auth/webauthn/*`, pair create/exchange —
orthogonal to OID4VC; do not break the SoftHSM PIN blob routes.

---

## Wallet lifecycle (wallet-api2 via proxy)

| Method | Path | Role |
|--------|------|------|
| GET | `/wallet-api/wallet` | List wallet ids |
| POST | `/wallet-api/wallet` | Create wallet |
| DELETE | `/wallet-api/wallet/{walletId}` | Delete wallet |

---

## Keys & DIDs (SECDSA)

| Method | Path | Role |
|--------|------|------|
| GET | `/wallet-api/wallet/{id}/keys` | List keys |
| POST | `/wallet-api/wallet/{id}/keys/generate` | Body: `backend: "secdsa"`, `keyType: "secp256r1"`, `config: {baseUrl, accountId, pin}` |
| POST | `/wallet-api/wallet/{id}/keys/secdsa/unlock` | Nitro: SoftHSM activate or instruct; body `{accountId, pin, mode}` |
| GET | `/wallet-api/wallet/{id}/keys/secdsa/status` | Nitro: activated? |
| GET | `/wallet-api/wallet/{id}/dids` | List DIDs |
| POST | `/wallet-api/wallet/{id}/dids/create` | Body: `{method: "jwk", keyId}` |

Key ids for SECDSA are expected to start with `secdsa:`.

---

## OID4VCI receive

| Method | Path | Role |
|--------|------|------|
| POST | `…/credentials/receive/resolve-offer` | Resolve credential offer |
| POST | `…/credentials/receive` | Pre-authorized receive |
| POST | `…/credentials/receive/authorization-url` | Auth-code start |
| POST | `…/credentials/receive/exchange-code` | Auth-code token |
| POST | `…/credentials/receive/request-nonce` | Nonce (if required) |
| POST | `…/credentials/receive/sign-proof` | PoP JWT (SECDSA sign) |
| POST | `…/credentials/receive/fetch-credential` | Fetch credential |

---

## OID4VP present

| Method | Path | Role |
|--------|------|------|
| POST | `…/credentials/present/resolve-request` | Resolve VP request (DCQL) |
| POST | `…/credentials/present/match-credentials-from-store` | Match store |
| POST | `…/credentials/present` | Submit presentation |
| GET | `…/credentials` / `…/credentials/{id}` | Credential store |

Optional / best-effort: `GET /wallet-api/transaction-data-profiles` (ignore if 404).

---

## Compatibility rules

1. Do not rename the paths above without updating web-wallet + mobile + this doc
   in the same change.
2. Holder keys remain `backend: "secdsa"` only for the demo happy path.
3. PIN must be validated against SoftHSM (activate if not activated; else instruct),
   not trusted from the client alone.
4. Wallet-api2 builds from Maven walt.id + in-repo `secdsa-waltid-adapter`
   (no waltid-identity checkout). Key generate is SECDSA-only.
