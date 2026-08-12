# Plan: walt.id Key adapter → SECDSA trust layer

**Goal:** This project implements a walt.id `Key` / KMS adapter that calls the
[HarryKodden/SECDSA](https://github.com/HarryKodden/SECDSA) **trust layer** (WSCA + SoftHSM).
Keep SECDSA free of walt.id / OID4VC code.

**Non-goals here:** forking walt.id Wallet UI; putting OID4VCI into SECDSA.

Educational use only — see [SECDSA USAGE.md](https://github.com/HarryKodden/SECDSA/blob/main/USAGE.md).
SECDSA remains patent-encumbered.

---

## 1. Target walt.id surface

Primary contract (from `id.walt.crypto.keys.Key` in waltid-crypto):

| walt.id method | Role |
|----------------|------|
| `KeyType` / generate | Create key (we only support **secp256r1 / P-256**) |
| `getKeyId()` | Stable key id string |
| `getThumbprint()` | JWK thumbprint of **public** key |
| `hasPrivateKey` | Always `true` for holder ops (priv never exported) |
| `exportJWK()` / `exportJWKObject()` | **Public** JWK only |
| `exportPEM()` | **Public** PEM only (or unsupported) |
| `getPublicKey()` / `getPublicKeyRepresentation()` | Public material |
| `getMeta()` | Backend metadata (`type=secdsa-wsca`, account, sn, …) |
| `signRaw(plaintext)` | ECDSA over digest/payload → DER or raw r‖s |
| `signJws(plaintext, headers)` | Compact JWS (OID4VCI PoP / OID4VP) |
| `verifyRaw` / `verifyJws` | Local verify with public JWK (no HSM needed) |
| `deleteKey()` | Soft-delete / revoke mapping (HSM key may remain) |
| `init()` | Optional: health-check WSCA |

Generation entry (same family as AWS/TSE backends): implement a `SECDSAKey` +
register with `KeyManager`, **or** implement walt.id wallet `WalletKeyStore` that
returns `SECDSAKey` instances.

**Recommended seam:** `SECDSAKey : Key` modeled after `AWSKey` / `TSEKey`
(remote sign, local public verify).

**This project:** `~/Projects/secdsa-waltid-adapter`  
**Trust layer:** `~/Projects/wsca` → [HarryKodden/SECDSA](https://github.com/HarryKodden/SECDSA)

---

## 2. Mapping: walt.id → trust layer

Assume the trust layer exposes a **stable remote WSCA HTTP API** (today’s lab is
in-process UI; Phase 0 extracts it). Account = walt.id wallet / user id.

| walt.id | Trust-layer call | Notes |
|---------|------------------|--------|
| **Generate P-256** | Ensure account activated (Protocol 4) if needed → `Instruct(GENKEY)` | Returns uncompressed pub in Tr result; adapter stores `keyId → {accountId, pub, pinRef}` |
| **getKeyId** | Local map | e.g. `secdsa:{accountId}:{sn}` or JWK thumbprint |
| **exportJWK / getPublicKey** | Local cache of pub from GENKEY Tr | Never export private |
| **signRaw(msg)** | `Instruct(SIGN, data=msg)` | Lab signs `SHA-256(data)` then ECDSA; align walt.id digest expectations (see §4) |
| **signJws(payload, headers)** | Build JWS signing input locally → `signRaw` on that input → assemble compact JWS | Header must advertise `ES256` + `jwk`/`kid` |
| **verify\*** | Pure local (java/kotlin crypto on pub JWK) | Do not round-trip HSM |
| **deleteKey** | Mark revoked in adapter DB | Optional later: WSCA “destroy key” op |

### PIN handling (critical)

walt.id KMS backends do **not** prompt for a PIN. The adapter must supply PIN/auth:

| Option | Pros | Cons |
|--------|------|------|
| **A. Session PIN** — walt.id (or thin UI) unlocks once; adapter holds PIN in memory for N minutes | Closest to wallet UX | Process memory risk (lab OK) |
| **B. PIN callback** — adapter API `Unlock(pin)` before any sign/gen | Explicit | Extra step for demos |
| **C. Dev-only static PIN** in env | Fast demos | Never for real use |

**Plan default:** B for demos (`POST /adapter/unlock`), A as optional improvement.

---

## 3. Trust-layer API the adapter needs

Expose from the **SECDSA trust-layer** repo (or a thin `cmd/wsca` sibling) — not from walt.id:

### 3.1 Already exist conceptually (lab)

| Capability | Lab today | Remote API shape (target) |
|------------|-----------|---------------------------|
| Activate | `POST /api/activate` | `POST /v1/accounts/{id}/activate` `{pin}` → IC meta |
| GENKEY | `POST /api/instruct` op=GENKEY | `POST /v1/accounts/{id}/keys` `{pin}` → `{keyId, publicJwk, trSn}` |
| SIGN | `POST /api/instruct` op=SIGN | `POST /v1/accounts/{id}/keys/{keyId}/sign` `{pin, payload, format}` → `{signature, trSn}` |
| Status / records | `GET /api/state` | `GET /v1/accounts/{id}` + `GET .../records/{sn}` |
| Judge package | `/api/judge/*` | optional for demos |

### 3.2 Gaps to close on the trust layer (before adapter is pleasant)

1. **Stable remote API** — split `cmd/lab` UI from `cmd/wsca` JSON API (multi-tenant accounts already sketched).
2. **Key id registry** — today one user key per account; walt.id expects many keys → either  
   - multiple SoftHSM key ids per account, or  
   - v1: one binding key per account (enough for PoC PoP).
3. **SIGN payload contract** — document whether `data` is raw bytes, pre-hashed, or JWS signing input; return DER vs P1363.
4. **Authn to WSCA** — lab has no bearer tokens; add demo API key or mTLS later.
5. **deleteKey / listKeys** — optional; stub in adapter first.

---

## 4. Crypto alignment checklist

| Topic | walt.id expectation | SECDSA lab today | Action |
|-------|---------------------|------------------|--------|
| Curve | secp256r1 OK | P-256 | Support **only** `KeyType.secp256r1`; reject others |
| `signRaw` | Often hash-then-sign or raw ECDSA | `SHA-256(data)` then ECDSA ASN.1 | Document; adapter may hash if walt.id passes plaintext |
| `signJws` | ES256 over JWS input | Need adapter assembly | Implement in adapter (Kotlin), call SIGN on signing-input bytes |
| Public JWK | `crv=P-256`, `x`,`y` | Uncompressed `04‖x‖y` from GENKEY | Convert in adapter |
| Private JWK | Must not export | Non-extractable | `exportJWK` = public only; `hasPrivateKey=true` |
| PoP for OID4VCI | `signJws` on issuer nonce | Via SIGN | Smoke-test against walt.id issuer or issuer.eudiw.dev |

---

## 5. Phased workplan

### Phase 0 — Trust-layer API freeze (SECDSA repo) · ~0.5–1 day

- [ ] In HarryKodden/SECDSA: add `cmd/wsca` (or `/v1/*` on lab) with activate / genkey / sign JSON.
- [ ] OpenAPI sketch there (minimal).
- [ ] Contract tests: activate → GENKEY → SIGN → verify signature locally with pub.
- [ ] Keep SECDSA docs free of walt.id; document the stable `/v1` API only.

**Exit:** `curl` can drive SoftHSM keys without the HTML UI.

### Phase 1 — Adapter skeleton (this repo) · ~1 day

- [x] Create `secdsa-waltid-adapter` scaffold (Kotlin).
- [x] Depend on `waltid-crypto` and subclass `Key`.
- [x] Implement `SECDSAKey`: generate, export public JWK, signRaw → HTTP.
- [x] Config: `WSCA_BASE_URL`, account id, unlock PIN API.
- [x] Interim lab parsing hardened (`userPub` + judge package); WireMock / Phase 0 fixtures still TODO.

**Exit:** `SECDSAKey.generate()` + `signRaw` round-trip against local lab (interim) / `cmd/wsca`.

### Phase 2 — JWS + walt.id Wallet API · ~1–2 days

- [x] Implement `signJws` / `verifyJws` in adapter (demo; true ES256 needs Phase 0 hash mode).
- [x] Register backend with walt.id `KeyManager` (`secdsa`) + `WaltCryptoSecdsa.init()` / `KeySerialization`.
- [x] Document Wallet API wiring: [docs/WALTID_WALLET_API.md](WALTID_WALLET_API.md).
- [x] Custom Wallet API PoC in sibling `waltid-identity` branch `secdsa-wallet-api-poc` (`waltid-crypto-secdsa` + `WaltCryptoSecdsa.init()`; compiles).
- [x] Local Wallet API smoke (`gradlew :waltid-wallet-api:run`): generate + export JWK + sign against lab.
- [ ] Docker image (`jibDockerBuild`) when daemon is up — use `COMPOSE_PROFILES=identity-old` for classic `wallet-api`.
- [ ] Manual: OID4VCI PoP via SECDSA SIGN (Phase 3).

**Exit:** Wallet API creates a key whose public material matches a Tr from your WSCA.

### Phase 3 — OID4VCI PoP smoke · ~1 day

- [ ] Pre-auth OID4VCI offer (walt.id issuer **or** issuer.eudiw.dev test cred).
- [ ] Receive credential with proof of possession signed via adapter → WSCA SIGN.
- [ ] Confirm Tr + audit trail in SECDSA lab for that SIGN.

**Exit:** One VC in walt.id wallet whose binding key was used only through SoftHSM.

### Phase 4 — Hardening (optional)

- [ ] Multi-key per account; `deleteKey`; list keys.
- [ ] Session unlock (PIN TTL); never log PIN.
- [ ] Adapter refuses Ed25519/secp256k1 clearly.
- [x] Document patent / educational limits in adapter README (point to SECDSA USAGE.md).

---

## 6. Repo boundaries

```text
HarryKodden/SECDSA          ← trust layer (WSCA + SoftHSM + Tr + monitor)
        ▲
        │ HTTPS activate / keys / sign
        │
HarryKodden/secdsa-waltid-adapter   ← SECDSAKey : walt.id Key
        ▲
        │ in-process Key API
        │
walt-id/waltid-identity (Wallet API) ← OID4VCI/VP (unchanged upstream as much as possible)
```

Do **not** vendor walt.id into SECDSA. Do **not** put OID4VC into SECDSA.

---

## 7. Interface sketch (adapter)

```kotlin
// Pseudocode — lives in adapter repo
class SECDSAKey(
  private val client: WscaClient,
  private val accountId: String,
  private val keyId: String,
  private val publicJwk: JsonObject,
) : Key() {
  override val keyType = KeyType.secp256r1
  override val hasPrivateKey = true

  override suspend fun signRaw(plaintext: ByteArray, alg: String?): Any =
    client.sign(accountId, keyId, plaintext) // → Instruct SIGN

  override suspend fun signJws(plaintext: ByteArray, headers: Map<String, JsonElement>): String {
    val jwsInput = buildSigningInput(headers, plaintext) // ES256
    val sig = signRaw(jwsInput) as ByteArray
    return compactJws(headers, plaintext, sig)
  }

  override suspend fun exportJWK() = publicJwk.toString()
  override suspend fun deleteKey() = client.revoke(accountId, keyId)
}

class WscaClient(baseUrl: String) {
  suspend fun unlock(accountId: String, pin: String)
  suspend fun ensureActivated(accountId: String, pin: String)
  suspend fun generate(accountId: String): SECDSAKey
  suspend fun sign(accountId: String, keyId: String, payload: ByteArray): ByteArray
}
```

---

## 8. Decision log (defaults)

| Decision | Default | Revisit when |
|----------|---------|--------------|
| walt.id seam | `Key` subclass (`SECDSAKey`) | WalletKeyStore-only embedding needed |
| Curve | P-256 / ES256 only | Product needs other algs (won’t use SECDSA lab) |
| Keys per account | **One** binding key (PoC) | Multi-cred demos need many keys |
| PIN | Explicit unlock API | UX wants session TTL |
| SIGN hash | Keep lab `SHA-256(data)`; adapter passes **already-hashed or JWS input** per documented flag | walt.id raw vs prehash mismatch |
| Trust API | New `/v1` on this repo | Adapter can temporarily scrape `/api/instruct` |

---

## 9. Immediate next actions

1. **SECDSA repo:** Phase 0 stable `/v1` WSCA API (trust-layer only).  
2. **This repo:** finish `SECDSAKey` + HTTP client against that API.  
3. **Demo script:** unlock → generate → signJws → verify with public JWK.  
4. Only then wire walt.id Wallet API / OID4VCI.

When Phase 0 is done, the adapter plan above is executable without further design.
