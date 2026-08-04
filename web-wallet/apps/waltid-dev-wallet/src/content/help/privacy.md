---
title: Privacy & usage
description: How this educational SECDSA wallet handles data
---

# Privacy & usage

This application is an **educational proof of concept**. It is not a production identity wallet and is not offered as a commercial service.

## What this demo stores

| Data | Where | Notes |
|------|--------|--------|
| Wallet IDs, DIDs, credential documents, events | Postgres (compose service) | Persists across wallet-api2 restarts |
| SECDSA key metadata (public JWK, SoftHSM key id, lab URL) | Postgres | **Private keys never leave SoftHSM** |
| SoftHSM private key material | SECDSA lab (memory WSCD) | Cleared if the `secdsa` container is recreated |
| SoftHSM PIN (session) | wallet-api2 process memory after unlock | Not written to the browser or config files |
| Login session (email / OIDC) | HTTP-only cookies via the Nuxt auth routes | Used to gate the UI for this demo |

Credentials you accept from external issuers (for example a sandbox OID4VCI agent) are stored in your local Postgres volume so you can present them later.

## What we do not do

- We do not sell or share your demo credentials with third parties.
- We do not send SoftHSM PINs to issuers or verifiers.
- We do not claim GDPR “production readiness” for this stack — treat all data as disposable lab data.

## SECDSA patent notice

SECDSA is patent-encumbered. Educational and research use only unless you have a license.

See [SECDSA USAGE.md](https://github.com/HarryKodden/SECDSA/blob/main/USAGE.md) and this repository’s `NOTICE` file.

## Third-party services

Depending on configuration, sign-in may use an external OIDC provider (for example SURF). Credential offers and presentations talk to whatever issuer/verifier URLs you scan — those parties process data under their own policies.

## Local control

You can wipe demo data by removing Compose volumes (this deletes wallets, credentials, and keys in Postgres) and restarting the SECDSA lab (this clears SoftHSM memory). Example:

```bash
docker compose down -v
docker compose up --build -d
```

## Contact

Questions about the SECDSA lab itself belong with the SECDSA project maintainers. Questions about walt.id wallet-api2 belong with the walt.id open-source community. This demo repo only wires the two together for local experimentation.

[← Back to Help](/help)
