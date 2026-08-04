---
title: Help
description: Using the walt.id + SECDSA educational wallet
---

# Help

This wallet is part of the **walt.id + SECDSA demo stack**. It stores verifiable credentials, creates DIDs from SoftHSM-backed keys, and speaks OpenID for Verifiable Credentials (OID4VCI / OID4VP) 1.0 via wallet-api2.

## Quick start

1. Sign in (email or OIDC, depending on how the demo is configured).
2. Open or create a wallet.
3. Under **Keys**, generate a SECDSA key (`secp256r1` / P-256). Enter the SoftHSM PIN when prompted.
4. Under **DIDs**, create a **did:jwk** from that key.
5. Scan or open a credential offer to **Accept** an issuance, or scan a presentation request to share a credential.

**Lab defaults:** account `citizen-42`, PIN `424242`. SoftHSM UI: [http://localhost:18080](http://localhost:18080).

## SECDSA PIN unlock

Before key generation or signing (receive / present), the wallet asks for the SoftHSM PIN and calls:

`POST /wallet/{id}/keys/secdsa/unlock`

The PIN unlocks the SoftHSM session in wallet-api2 memory. It is **not** written into long-lived browser storage or HOCON config.

## Keys & DIDs

| Action | Where |
|--------|--------|
| Generate SECDSA key | Wallet → Settings → Keys → Generate |
| Create `did:jwk` | Wallet → Settings → DIDs → New → JWK |
| Inspect / delete | Keys or DIDs list → View |

`did:jwk` only needs the **public** JWK cached at key generation. Signing still requires SoftHSM + PIN.

### One SoftHSM key per account

The SECDSA lab keeps **one user key** for account `citizen-42`. If another wallet regenerates a key against the same account, older wallets can keep a **stale** public JWK / DID. Issuers then reject proofs with `invalid_request`.

**Fix:** delete that wallet’s SECDSA key and DID, generate again (reuses the current SoftHSM key), create a fresh `did:jwk`, then use a **new** credential offer.

## Receiving a credential

1. Open **Scan** in the wallet.
2. **Same computer as the issuer page:** paste the offer link (or the `https://…/get-credential-offer/…` URL), or upload a screenshot of the QR. The camera cannot read a QR on the same screen.
3. **Phone / second device:** use the camera to scan the QR.
4. Review the issuer and credential type, select your `did:jwk`.
5. Depending on the grant shown on the issuance page:
   - **pre-authorized_code** — enter the SECDSA PIN and click **Accept**.
   - **authorization_code** — click **Continue at issuer**, sign in at the issuer, then return via `/oid4vci/callback` and unlock with the PIN to finish.

Pre-authorized offers are typically **single-use**. If Accept already exchanged the code for a token but failed later, request a new offer from the issuer.

For authorization_code, register `OID4VCI_CLIENT_ID` / `OID4VCI_REDIRECT_URI` (default `http://localhost:7115/oid4vci/callback`) at the issuer’s authorization server. Dev sandbox: [eduWallet sandbox](https://sandbox.dev.eduwallet.nl/).

## Presenting a credential

1. Open or scan an OID4VP request.
2. Choose which credential to share.
3. Unlock SoftHSM with the PIN so the wallet can sign the presentation proof.

## Useful links

- [Settings](/settings) — SECDSA defaults and wallet shortcuts
- [Privacy & usage](/help/privacy) — data handling and patent notice
- Wallet API Swagger: [http://localhost:7006/swagger](http://localhost:7006/swagger)
- Issuer API Swagger: [http://localhost:7005/swagger](http://localhost:7005/swagger)
- Verifier API Swagger: [http://localhost:7004/swagger](http://localhost:7004/swagger)

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Accept fails with `invalid_request` | Stale SoftHSM key/DID (see above) or burned offer |
| Auth-code callback: no matching `state` | Session expired / different browser tab — restart from Scan |
| Auth-code: `redirect_uri` / `invalid_client` | `OID4VCI_*` not registered at the issuer AS |
| PIN modal keeps failing | Wrong PIN, or SECDSA lab not running (`docker compose ps`) |
| Empty keys after restart | Memory WSCD was wiped — regenerate key + DID |
| Create DID looks failed but DID exists | Older proxy gzip bug — rebuild/restart `web-wallet` |

Still stuck? Check `docker compose logs wallet-api2 --tail 100` for the receive / sign error.
