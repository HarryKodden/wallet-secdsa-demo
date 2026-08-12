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
