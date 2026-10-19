# SECDSA PIN web wallet

Nuxt wallet that talks to **wallet-api2** and unlocks the SECDSA key store with a PIN.

In this demo project it is built and run by Docker Compose (`web-wallet` service on host port `7115`).

OIDC uses Nitro routes under `/wallet-api/auth/oidc-*` (classic wallet-api contract).
Register redirect URI `http://localhost:7115/wallet-api/auth/oidc-session`.

For local npm development (stack already up):

```bash
cd web-wallet
npm install
cd apps/waltid-dev-wallet
WALLET_API2_PROXY=http://127.0.0.1:7006 \
WSCA_INTERNAL_URL=http://secdsa:8080 \
OIDC_CLIENT_ID=$OIDC_CLIENT_ID \
OIDC_CLIENT_SECRET=$OIDC_CLIENT_SECRET \
OIDC_BASE_URL=http://localhost:7115 \
npm run dev
```

Default lab credentials: account `citizen-42`, PIN `424242`.
