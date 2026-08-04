# wallet-api2 (SECDSA-enabled)

Docker image for OID4VC wallet-api2 with the SECDSA key backend.

## Build artefacts (`dist/`)

`dist/` is **not** committed. Produce it from sibling checkouts:

```bash
./scripts/build-wallet-api2.sh
docker compose build wallet-api2
```

| Env | Default |
|-----|---------|
| `WALTID_IDENTITY_PATH` | `~/Projects/waltid-identity` ([waltid-identity-secdsa](https://github.com/HarryKodden/waltid-identity-secdsa) checkout) |
| `SECDSA_ADAPTER_PATH` | `~/Projects/secdsa-waltid-adapter` |

## Auth / ownership

- `config/_features.conf` enables **`auth`** and **`wallet2-persistence`**.
- Register / login: `POST /auth/register`, `POST /auth/emailpass`.
- Wallet list/create require a JWT; wallets are linked to the account (`sub`).
- The Nuxt web-wallet bridges OIDC → a JIT wallet-api2 account (see
  `OIDC_BRIDGE_SECRET` in `.env.example`). Do not send IdP JWTs as Bearer
  tokens to wallet-api2.
- Account directory is **in-memory** (upstream); keep this stack on localhost and
  expect re-register after API restarts.
