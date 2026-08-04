# wallet-api2 config

Educational PoC only. See repo root `NOTICE` and `README.md`.

- `_features.conf` — enables Postgres persistence (`wallet2-persistence`) and
  **`auth`** (JWT accounts + per-account wallet ownership).
- `auth.conf` — JWT signing key for session tokens; **demo private JWK** — rotate
  before any shared deploy.
- Accounts are stored **in-memory** in wallet-api2 today (upstream OSS). Restarting
  the container clears passwords/accounts; wallet rows + ownership links in Postgres
  may then look “orphaned” until users re-register. Ownership isolation still holds
  for active sessions.
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
