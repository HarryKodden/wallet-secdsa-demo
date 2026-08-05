# wallet-api2 config

Educational PoC only. See repo root `NOTICE` and `README.md`.

- `_features.conf` — enables Postgres persistence (`wallet2-persistence`) and
  **`auth`** (JWT accounts + per-account wallet ownership).
- `auth.conf` — JWT signing key for session tokens; **demo private JWK** — rotate
  before any shared deploy.
- Auth accounts (email/password) are snapshotted to
  `WALLET2_ACCOUNT_STORE_PATH` (compose volume `wallet-api2-accounts`, default
  `/data/wallet2-accounts.json`) so the same `accountId` is restored after
  `wallet-api2` restart and can still see Postgres wallets/credentials.
  Set `WALLET2_ACCOUNT_STORE_PATH=none` to disable. SECDSA key material remains
  in the memory WSCD and is separate from this file.
- `oidc.conf` — reference OIDC settings; live login is in the Nuxt web-wallet
  Nitro routes (`/wallet-api/auth/oidc-*`)
- `wallet2-persistence.conf` — JDBC to the compose `postgres` service
- `web.conf` / `wallet-service.conf` — bind + public base URL

Register OIDC redirect URI at the IdP:

`http://localhost:7115/wallet-api/auth/oidc-session`

Set `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` in `.env` (passed to `web-wallet`).

SECDSA is not configured here. Keys are created with `backend: "secdsa"` and
`config.baseUrl` pointing at the compose service `http://secdsa:8080`. Unlock via:

`POST /wallet/{id}/keys/secdsa/unlock` with `{ "accountId", "pin" }`.
