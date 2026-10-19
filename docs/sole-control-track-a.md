# Sole-control Track A (cloud / WP HSM) — contracts

**Status:** G0–G5 done (flag still default off)  
**Flag:** `SOLE_CONTROL_SIGNING` (default `false` — legacy PIN session still works)  
**Related:** [`key-creation-architecture.md`](key-creation-architecture.md) · `TODO.md` **P3-SC**

---

## 1. Problem (today)

| Fact | Implication |
|------|-------------|
| Private key lives in SECDSA lab (cloud WSCD) | OK for Track A *placement* |
| `POST …/keys/secdsa/unlock` stores PIN in `SecdsaPinSession` (process memory) | wallet-api2 can call lab **SIGN** until restart |
| Accept / Present only check “is PIN unlocked?” | **Not** sole control — backend is a co-signer while unlocked |

**Legacy path (flag off):** keep current unlock session for demos/smoke.  
**Target path (flag on):** SIGN requires a short-lived **SignGrant** minted after user presence + consent.

---

## 2. Trust boundary (target)

```text
User device                 wallet-api2                    SECDSA lab
───────────                 ───────────                    ──────────
Presence (WebAuthn)    →    mint SignGrant
Consent (Accept/Present)→   bind purpose + optional digest
Receive/Present        →    consume grant ─────────────→ SIGN
                            (no free PIN session SIGN)
```

| Actor | May hold `d`? | May SIGN as holder? |
|-------|---------------|---------------------|
| Issuer / verifier | No | No |
| wallet-api2 alone (no grant) | No | **No** (flag on) |
| wallet-api2 + valid SignGrant | No | Yes, once (or once per bound tx) |
| SECDSA lab | Yes | Executes SIGN when instructed |

Residual risk (document, do not ignore): XSS during a live signing window can mint/consume grants; TTL + visibility clear mitigate.

---

## 3. UX doctrine (product)

```text
Biometric / FIDO2  →  open short signing window (presence)
Consent sheet      →  “Accept / Present to X?”
SECDSA SIGN        →  only for that act, under a SignGrant
PIN                →  SoftHSM activate / lockout / step-up — not every op
```

Browse / resolve-offer / match-credentials: **no** grant.  
PoP (receive) and VP/KB-JWT (present): **grant required** when flag on.

---

## 4. Frozen API sketch

Base: same auth as today (`Authorization: Bearer` wallet-api2 JWT).  
Paths under `/wallet/{walletId}/keys/secdsa/…`.

### 4.1 Status (extended)

`GET /wallet/{walletId}/keys/secdsa/status?accountId=…`

| Field | Type | Meaning |
|-------|------|---------|
| `soleControlSigning` | boolean | `SOLE_CONTROL_SIGNING` env |
| `pinSessionActive` | boolean | Legacy PIN in process memory (**demo-only** when sole-control on) |
| `signGrantActive` | boolean | Optional: any non-expired grant for this wallet+account |

### 4.2 Mint grant

`POST /wallet/{walletId}/keys/secdsa/authorize-sign`

**Request**

```json
{
  "accountId": "oidc-sub-or-citizen-42",
  "keyId": "secdsa:…:1",
  "purpose": "issuance",
  "pin": "424242",
  "binding": {
    "offerId": "optional",
    "requestHash": "optional-sha256-hex-of-authz-request-or-vp-context",
    "clientId": "optional-verifier-or-issuer-client"
  }
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `accountId` | yes | SoftHSM / WSCA account |
| `keyId` | yes | Must be SECDSA key in this wallet |
| `purpose` | yes | `issuance` \| `presentation` \| `keygen` (keygen optional later) |
| `pin` | yes (mint) | SoftHSM unlock proof at mint; UI gets it from PRF restore or PIN step-up after WebAuthn presence (G2). Bound to grant when flag on — not a free session |
| `binding` | recommended | Soft-checked on consume when expected context is supplied |

**Response `201`** — `{ signGrant, purpose, keyId, expiresAt, ttlSeconds, soleControlSigning }`

**Errors:** `400` bad body / SoftHSM unlock fail; `403` key not in wallet; `401` auth; `429` rate limited.

### 4.3 Consume grant (receive / present)

| Endpoint | New field |
|----------|-----------|
| `POST …/credentials/receive` (and reviewed variants) | `signGrant?: string` |
| `POST …/credentials/present` (and isolated) | `signGrant?: string` |

When `SOLE_CONTROL_SIGNING=true`:

- Missing / expired / wrong `purpose` / wrong `keyId` → **403** `{ "error": "sign_grant_required", … }`
- On successful PoP or VP SIGN → **consume** grant (single-use per grant id)

When flag **false**: ignore `signGrant`; legacy `SecdsaPinSession` behavior unchanged.

### 4.4 Demo sign route

`POST …/keys/{keyId}/sign` — when flag on: **always 403** (`sign_grant_required`).

### 4.5 Grant-scoped SoftHSM PIN (G3)

When flag on, `authorize-sign` proves the PIN then **binds it to the SignGrant**.
`SignGrantGuard` installs that PIN into `SecdsaPinSession` only for the consume
request, then clears it. Unlock verifies SoftHSM but does **not** leave free SIGN.

---

## 5. TTL decisions (G0 freeze)

| Parameter | Value | Rationale |
|-----------|--------|-----------|
| SignGrant TTL | **180 s** (3 min) | Long enough for Accept + network; short enough to limit orphan grants |
| Grant use | **Single-use** | One grant → one SIGN chain for that receive or present call |
| Multi-credential present | One grant covers all SIGNs inside **one** `present` request | Avoid N prompts mid-flight |
| Signing window (client, G2) | Align with grant TTL; clear on `visibilitychange` hidden | Fresh presence next act |
| PIN in `SecdsaPinSession` when flag on | Grant-scoped only | Cleared after consume request |

---

## 6. Feature flag + rollback

| Env | Default | Effect |
|-----|---------|--------|
| `SOLE_CONTROL_SIGNING` | `false` / unset | Legacy PIN session SIGN (current demo) |
| `SOLE_CONTROL_SIGNING=true` | — | Enforce SignGrant on holder SIGN paths (G1–G3) |

**Enable:**

```bash
SOLE_CONTROL_SIGNING=true docker compose up -d --force-recreate wallet-api2
./scripts/smoke-sole-control-grant.sh
```

**Rollback:** `SOLE_CONTROL_SIGNING=false` (or unset) + recreate `wallet-api2`.

**Rate limits (G4, in-process):**

| Env | Default | Meaning |
|-----|---------|---------|
| `SOLE_CONTROL_AUTHORIZE_RATE_MAX` | `30` | authorize-sign attempts / account / window |
| `SOLE_CONTROL_PIN_FAIL_RATE_MAX` | `10` | SoftHSM PIN failures / account / window |
| `SOLE_CONTROL_RATE_WINDOW_MS` | `300000` | Window (5 min) |

Audit events (`SoleControl` in wallet event log + redacted logs): `authorize_sign`,
`grant_consumed`, `grant_denied`. Never logs PIN or full grant ids.

---

## 7. Phase map

| Phase | Deliverable |
|-------|-------------|
| **G0** | This doc + flag + status field + API sketch frozen |
| **G1** | Enforce SignGrant on receive/present/`sign-proof`; demo sign 403 |
| **G2** | WebAuthn window + consent sheet; UI sends `signGrant` |
| **G3** | Grant-scoped PIN; unlock clears session; smoke + rollback docs |
| **G4** | Adapter SignGrant docs; audit + rate-limit; threat checklist; challenge–response sketch (**done**) |
| **G5** | README LoA honesty; key-creation deprecate PIN path; HSM ops gate (**done**) |

---

## 8. G4 — Harden notes

### 8.1 Adapter instruction model

See [`secdsa-waltid-adapter/docs/ADAPTER.md`](../secdsa-waltid-adapter/docs/ADAPTER.md):
SignGrant authorizes the act; PIN unlock session is legacy. NOTICE / patent terms
unchanged — align with richer lab sole-control APIs when available (digest SIGN).

### 8.2 Optional challenge–response (sketch)

Not required for flag-on demos today. Soft binding already supports
`binding.requestHash` on mint + match on consume when expected context is passed.

```text
UI: SHA-256(authz or VP context) → binding.requestHash on authorize-sign
API2: soft-enforce on consume
Future lab: SIGN(digest, grantRef) without PIN-on-every-instruct
```

### 8.3 Threat checklist (flag on)

| Check | Status |
|-------|--------|
| wallet-api2 alone cannot Accept (receive PoP) without SignGrant | Yes — `SignGrantGuard` |
| wallet-api2 alone cannot Present without SignGrant | Yes |
| Demo `/keys/{id}/sign` cannot bypass | Yes — hard 403 |
| Unlock does not leave PIN-forever for SIGN | Yes — session cleared |
| Grant is single-use + TTL | Yes |
| XSS during live signing window can still mint/consume | **Residual** — TTL + `visibilitychange` clear mitigate; not eliminated |
| Rate-limit + redacted audit on mint / deny / PIN fail | Yes (in-process) |

---

## 9. G5 — Docs + decision gate

### 9.1 What we claim / do not claim

| Claim | Allowed? |
|-------|----------|
| Demo sole-control Track A with flag on (presence + consent + grant) | Yes |
| SoftHSM lab binds keys for educational demos | Yes |
| Certified LoA High / QEAA / eIDAS high | **No** |
| DIIP / EUDI / FIDES wallet catalog readiness | **No** until evidence + WSCD ops decision |

### 9.2 SoftHSM lab vs production HSM (ops choice)

| Option | Use when | Notes |
|--------|----------|--------|
| **Compose SoftHSM / memory WSCD** (current) | Local demos, CI smoke | Keys die with container; not certified |
| **Production PKCS#11 / eIDAS HSM** | Real deployments | Ops/procurement decision; adapter stays HTTP/instruct bridge; patent NOTICE still applies to SECDSA stack |

Track A keeps keys in cloud/WP HSM placement. Track B (on-device keygen) is separate and parked.

---

## 10. Non-goals

- On-device private key generation (Track B)
- Browser WebCrypto holder keys
- Uploading `d` to the lab
- Claiming certified LoA High / QEAA / EUDI catalog readiness
