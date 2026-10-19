# Sole-control Track A (cloud / WP HSM) — contracts

**Status:** G0–G2 done · **G3** flag-on smoke / mobile next (flag still default off)  
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
**Target path (flag on):** SIGN requires a short-lived **SignGrant** minted after user presence (+ later consent UX).

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

Add fields (backward compatible):

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
| `pin` | yes (mint) | SoftHSM unlock proof at mint; UI gets it from PRF restore or PIN step-up after WebAuthn presence (G2). Not stored for ongoing SIGN when flag on |
| `binding` | recommended | Opaque context; G3 binds receive/present |

**Response `201`**

```json
{
  "signGrant": "<opaque>",
  "purpose": "issuance",
  "keyId": "secdsa:…:1",
  "expiresAt": "2026-10-19T08:05:00Z",
  "ttlSeconds": 180
}
```

**Errors:** `400` bad body; `403` key not in wallet; `401` auth; SoftHSM unlock fail → `400` with message.

### 4.3 Consume grant (receive / present)

Extend existing bodies (additive):

| Endpoint | New field |
|----------|-----------|
| `POST …/credentials/receive` (and reviewed variants) | `signGrant?: string` |
| `POST …/credentials/present` (and isolated) | `signGrant?: string` |

When `SOLE_CONTROL_SIGNING=true`:

- Missing / expired / wrong `purpose` / wrong `keyId` → **403** `{ "error": "sign_grant_required", … }`
- On successful PoP or VP SIGN → **consume** grant (single-use per grant id)

When flag **false**: ignore `signGrant`; legacy `SecdsaPinSession` behavior unchanged.

### 4.4 Demo sign route

`POST …/keys/{keyId}/sign` — when flag on: require `signGrant` with purpose allowing demo sign, or return 403. (G3)

---

## 5. TTL decisions (G0 freeze)

| Parameter | Value | Rationale |
|-----------|--------|-----------|
| SignGrant TTL | **180 s** (3 min) | Long enough for Accept + network; short enough to limit orphan grants |
| Grant use | **Single-use** | One grant → one SIGN chain for that receive or present call |
| Multi-credential present | One grant covers all SIGNs inside **one** `present` request | Avoid N prompts mid-flight |
| Signing window (client, G2) | Align with grant TTL; clear on `visibilitychange` hidden | Fresh presence next act |
| PIN in `SecdsaPinSession` when flag on | **Do not use for SIGN** after G1 | May still briefly unlock lab during grant mint |

---

## 6. Feature flag

| Env | Default | Effect |
|-----|---------|--------|
| `SOLE_CONTROL_SIGNING` | `false` / unset | Legacy PIN session SIGN (current demo) |
| `SOLE_CONTROL_SIGNING=true` | — | Enforce SignGrant on holder SIGN paths (as they are wired in G1–G3) |

Compose: pass through `wallet-api2` environment (see `.env.example`).

---

## 7. Phase map

| Phase | Deliverable |
|-------|-------------|
| **G0** | This doc + flag + status field + API sketch frozen |
| **G1** | `SignGrantStore`, authorize-sign, **enforce** on receive/present/`sign-proof` behind flag; demo `/keys/…/sign` disabled when flag on |
| **G2** | WebAuthn window + consent sheet; PIN step-up; UI sends `signGrant` (**done**) |
| **G3** | receive/present + mobile + smoke + gate demo sign |
| **G4** | Challenge–response option, audit, adapter docs |
| **G5** | README honesty, HSM decision gate |

---

## 8. Non-goals

- On-device private key generation (Track B)
- Browser WebCrypto holder keys
- Uploading `d` to the lab
- Claiming certified LoA High / QEAA / EUDI catalog readiness
