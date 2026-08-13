# Vendored / overlay sources (Chapter F)

This directory is a **standalone** wallet-api2 build. It does not clone
`waltid-identity-secdsa`.

| Piece | Origin |
|-------|--------|
| App (`Main`, auth, `SecdsaUnlockRoutes`, …) | Adapted from private SECDSA mirror of walt.id wallet-api2 |
| `Wallet2RouteHandler` overlay | Fork patch: dynamic `KeyGenerationRequest` + demo routes; Phase 2 restricts generate to `backend=secdsa`; wallet `displayName` list/update |
| `Wallet`, `WalletDescriptor`, `WalletResolver`, `ExposedWalletStore`, `Wallet2Tables` | Overlay: persist optional `displayName` on wallets |
| `Wallet2OpenApiDocs` + `Wallet2RequestExamples` | Fork overlay: must match fork DTOs (stock 0.23.1 jar breaks at runtime) |
| `Wallet2EventLog` | Fork patch (in-memory; stock 0.23.1 has no event log) |
| `openid4vci` metadata overlays (`CredentialFormat`, `CredentialIssuerMetadata`, `CredentialConfiguration`, `SigningAlgId`, `AuthorizationServerMetadata`) | Fork overlay: eduWallet sandbox metadata uses legacy `vc+sd-jwt`, skips invalid `ldp_vc` entries, and token-only OAuth AS (no `authorization_endpoint`); stock Maven 0.23.1 fails issuer/AS metadata resolve |
| `openid4vp` / DCQL overlays (`DcqlMatcher`, `CredentialFormat`, `CredentialQuery`, `AuthorizationRequestResolver`, `WalletPresentFunctionality2`, `PresentationRequestValidator`, verifier `CredentialFormat`, `clientidprefix`) | Fork overlay: eduWallet presentation uses `vc+sd-jwt` DCQL, W3C `type_values` on SD-JWT, request_uri content-type sniffing, empty direct_post bodies |
| `WalletPresentationHandler`, `PreviewSessionStore`, `WalletIssuanceHandler`, `JwtProofBuilder` | Fork overlay: holder key/DID from credential `cnf` (not wallet default), `clientId` on proof JWT `iss`, preview session store; remaps W3C+SD-JWT `jwt_vc_json` → `vc+sd-jwt` for DCQL; auth-code **PAR** when AS `require_pushed_authorization_requests` |
| Libraries | Maven `id.walt.*:0.23.1` from `https://maven.waltid.dev/releases` |
| SECDSA crypto | `../secdsa-waltid-adapter` (compiled via `sourceSets`) |

walt.id code remains Apache-2.0; SECDSA terms apply separately (see root `NOTICE`).
