# Adapter cheat-sheet

walt.id `Key` → SECDSA WSCA (see plan in SECDSA repo).

| walt.id | HTTP (target `/v1`) | Lab today (interim) |
|---------|---------------------|---------------------|
| unlock / session | `POST /v1/accounts/{id}/unlock` | pin on each instruct |
| generate P-256 | `POST /v1/accounts/{id}/keys` | activate + instruct GENKEY; pub from snapshot `userPub` (not truncated `lastResult`) |
| signRaw / signJws | `POST /v1/accounts/{id}/keys/{kid}/sign` | instruct SIGN; full DER hex from `/api/judge/package` record `result` |
| exportJWK (public) | cached from GENKEY | uncompressed `04‖x‖y` → JWK |
| verify* | local | local SHA256withECDSA |
| deleteKey | adapter stub | — |

PIN default: explicit unlock before gen/sign (plan option B).
PoC: one SoftHSM user key per account — `generateKey()` reuses `userPub` when present.

---

## Sole-control Track A (instruction / SignGrant — not PIN unlock session)

**Target model** (wallet-api2 when `SOLE_CONTROL_SIGNING=true`):

```text
Presence + consent (web) → POST …/authorize-sign (PIN proof once)
                         → opaque SignGrant (TTL, single-use, purpose+key bound)
Receive / Present        → consume grant → adapter SIGN for that act only
```

| Concept | Role |
|---------|------|
| SoftHSM PIN | Activate / lockout / **mint proof** — not a long-lived “unlocked ⇒ SIGN anything” session |
| `SecdsaPinSession` | **Legacy / demo** when flag off. When flag on: cleared after unlock & after grant-scoped SIGN |
| SignGrant | Short authorization for one issuance or presentation SIGN chain |
| Adapter `SECDSAKey.sign*` | Still calls lab SIGN with a PIN; wallet-api2 supplies grant-scoped PIN only inside the consume window |

**Do not** document or implement “unlock once, keep PIN in adapter for the process” as the sole-control path.

Contracts: [`docs/sole-control-track-a.md`](../../docs/sole-control-track-a.md) in the demo repo.

### Optional challenge–response (lab evolution)

When richer SECDSA lab APIs exist (digest + presence → SIGN without shipping PIN on every instruct):

1. Wallet UI hashes authz/VP context → `binding.requestHash` on `authorize-sign`
2. Grant store already soft-enforces `requestHash` when consume supplies expected binding
3. Future lab: instruct SIGN with digest + grant reference; adapter stays a thin HTTP bridge

**NOTICE / patent terms unchanged** — educational use; see repo `NOTICE` and
[SECDSA USAGE.md](https://github.com/HarryKodden/SECDSA/blob/main/USAGE.md).
