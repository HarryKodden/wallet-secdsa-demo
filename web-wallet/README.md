# Web Wallet (SECDSA PIN UX clone) → wallet-api2

Educational clone of [`waltid-web-wallet`](../waltid-web-wallet) with SoftHSM / SECDSA PIN
interaction, retargeted at **wallet-api2** (`:7006`, OID4VC 1.0).

**Not for upstream walt.id PRs** (SECDSA is patent-encumbered — see
[USAGE.md](https://github.com/HarryKodden/SECDSA/blob/main/USAGE.md)).

## Ports

| App | Port |
|-----|------|
| Dev wallet | **7115** |
| Demo wallet | **7112** |

## Backend

Nitro `routeRules`:

`/wallet-api/**` → `http://localhost:7006/**` (prefix stripped)

| Flow | wallet-api2 |
|------|-------------|
| Unlock | `POST /wallet/{id}/keys/secdsa/unlock` |
| Receive | `POST /wallet/{id}/credentials/receive` `{ offerUrl, did? }` |
| Present | `POST /wallet/{id}/credentials/present` `{ requestUrl }` |
| Create wallet | `POST /wallet` (auto on first visit; id in `localStorage`) |

Auth: wallet-api2 `auth` feature is optional. HOCON `DirectSerializedKey` loading is
not wired yet — leave `auth` disabled and skip Nuxt login middleware for now.
SURF OIDC remains classic wallet-api only.

## Run

```bash
# stack: wallet-api2 + issuer-api2 (+ SECDSA lab)
cd waltid-applications/waltid-web-wallet-secdsa/apps/waltid-dev-wallet
npm install
npm run dev
# → http://localhost:7115
```

1. Open http://localhost:7115 → auto-creates a wallet-api2 wallet  
2. Settings → Keys → generate **SECDSA SoftHSM** (PIN modal) + create DID  
3. Create offer at http://localhost:7105 or:

```bash
curl -sS -X POST http://localhost:7005/issuer2/credential-offers \
  -H 'Content-Type: application/json' \
  -d '{"profileId":"openBadgeCredential","authMethod":"PRE_AUTHORIZED","expiresInSeconds":3600}'
```

4. Wallet → Scan → paste `openid-credential-offer://…` → Accept → enter SECDSA PIN  

## Next

- Wire wallet-api2 auth (Hoplite decoder for `DirectSerializedKey`) + email/OIDC  
- Mirror PIN UX in an iOS wallet clone  
