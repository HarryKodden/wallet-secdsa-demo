# walt.id 0.23.1 vs OID4VC 1.0 / DIIP (gap matrix)

Pinned wire: **OID4VCI 1.0** + **OID4VP 1.0** (+ errata). Interop profile: **DIIP first**
([published](https://fidescommunity.github.io/DIIP/)) on that 1.0 wire — not a separate protocol.
Library: Maven `id.walt.*:0.23.1` + in-repo overlays (`VENDOR.md`).

Legend: **Stock** = upstream jar · **Overlay** = this repo · **Gap** = not claimed / later track

## OID4VCI

| DIIP / 1.0 expectation | Status | Notes |
|------------------------|--------|-------|
| Metadata discovery (issuer + AS) | Overlay | Soft-fail configs; token-only AS; legacy `vc+sd-jwt` alias |
| Separate AS vs credential issuer | Stock + Overlay | `authorization_servers` + fallback |
| Nonce + JWT PoP | Overlay | `JwtProofBuilder`; `kid` from DID `authentication`; `iss` = `client_id` when present (walt.id issuer requires match to access-token `client_id`) |
| PKCE S256 | Overlay | Forced; plain-only AS rejected |
| PAR when required | Overlay | `WalletIssuanceHandler` |
| `authorization_details` + `scope` | Overlay | Always auth_details; scope = `openid` + config scope |
| `tx_code` pre-authorized | Overlay + UI | API + issuance page |
| Batch credential endpoint | Gap | Receive loops configs one-by-one |
| Immediate Issuance (issuer push) | Gap | `?accept=` / “immediate” receive is UX auto-accept, not the protocol feature |
| Issuer-initiated offers | Overlay (ingest) | `openid-credential-offer://`, `openid-initiate-issuance://`, HTTPS wrap |

## OID4VP

| Expectation | Status | Notes |
|-------------|--------|-------|
| DCQL (not Presentation Exchange) | Overlay | PD rejected |
| `request_uri` + `request_uri_method` | Overlay | GET/POST + content-type sniff |
| Client id scheme `did` | Overlay | Bare `did:…` + `decentralized_identifier:` |
| `direct_post` / `vp_token` | Overlay | Empty-body tolerance |
| `trusted_authorities` | Overlay | Enforced via `TrustedAuthoritiesChecker` |
| OpenID Federation client id | Gap | Parsed; trust chain not implemented |
| DC API | Gap | P3 |

## Formats & DIDs

| Expectation | Status | Notes |
|-------------|--------|-------|
| ES256 / secp256r1 | Adapter | SECDSA SoftHSM path |
| `dc+sd-jwt` / `vc+sd-jwt` | Overlay | Format aliases + present remap from stock `jwt_vc_json` |
| W3C VCDM 2.0 + VC-JOSE-COSE as distinct profile | Gap | Interop via JWT/SD-JWT remaps; **not** claiming full VC-JOSE-COSE |
| `did:jwk` holder | Stock + UX | Default auto-create |
| `did:web` holder | Partial | Create UI exists; hosting DID document is operator responsibility |
| Holder `cnf.kid` | Partial | Issuer-set on credential; wallet matches key by `cnf` / subject; PoP `kid` from `authentication` VM |

## Errors

| Expectation | Status | Notes |
|-------------|--------|-------|
| AS/issuer/verifier codes → 4xx | Overlay | `Oid4vcProtocolErrors` on receive / fetch / auth-code / present / resolve |
| Systematic catalog for every walt.id throw | Partial | Heuristic classification; remaining untyped paths may still 500 |

## Upstream notes

- Prefer contributing format/`dc+sd-jwt` + DCQL W3C-meta fixes upstream so overlays shrink.
- Proof JWT `iss`: walt.id issuer-api2 requires `iss` = access-token `client_id` for both pre-auth and auth-code; DIIP `iss=did` remains available when `clientId` is blank.
- Batch issuance and true Immediate Issuance need library + product work (P2+).

Last reviewed with P1 close-out in this repo.
