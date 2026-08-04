# SECDSA PIN web wallet (Nuxt) → wallet-api2 + SECDSA key store.
FROM node:22-bookworm AS build
WORKDIR /app

ARG NUXT_PUBLIC_APP_VERSION=DEV
ARG NUXT_PUBLIC_WSCA_ACCOUNT_ID=citizen-42
ARG NUXT_PUBLIC_WSCA_BASE_URL=http://secdsa:8080
ARG WALLET_API2_PROXY=http://wallet-api2:7006
ARG NUXT_PUBLIC_OIDC_CLIENT_ID=
ARG NUXT_PUBLIC_OIDC_AUTHORIZE_URL=https://oidc.pilot1.sram.surf.nl/authorize
ARG NUXT_PUBLIC_OIDC_REDIRECT_URI=http://localhost:7115/wallet-api/auth/oidc-session
ARG NUXT_OIDC_TOKEN_URL=https://oidc.pilot1.sram.surf.nl/token
ARG NUXT_PUBLIC_OIDC_SCOPES="openid email profile"
ARG NUXT_PUBLIC_OID4VCI_CLIENT_ID=wallet-secdsa-demo
ARG NUXT_PUBLIC_OID4VCI_REDIRECT_URI=http://localhost:7115/oid4vci/callback
ENV NUXT_PUBLIC_APP_VERSION=$NUXT_PUBLIC_APP_VERSION \
    NUXT_PUBLIC_WSCA_ACCOUNT_ID=$NUXT_PUBLIC_WSCA_ACCOUNT_ID \
    NUXT_PUBLIC_WSCA_BASE_URL=$NUXT_PUBLIC_WSCA_BASE_URL \
    NUXT_PUBLIC_OIDC_CLIENT_ID=$NUXT_PUBLIC_OIDC_CLIENT_ID \
    NUXT_PUBLIC_OIDC_AUTHORIZE_URL=$NUXT_PUBLIC_OIDC_AUTHORIZE_URL \
    NUXT_PUBLIC_OIDC_REDIRECT_URI=$NUXT_PUBLIC_OIDC_REDIRECT_URI \
    NUXT_OIDC_TOKEN_URL=$NUXT_OIDC_TOKEN_URL \
    NUXT_PUBLIC_OIDC_SCOPES=$NUXT_PUBLIC_OIDC_SCOPES \
    NUXT_PUBLIC_OID4VCI_CLIENT_ID=$NUXT_PUBLIC_OID4VCI_CLIENT_ID \
    NUXT_PUBLIC_OID4VCI_REDIRECT_URI=$NUXT_PUBLIC_OID4VCI_REDIRECT_URI \
    WALLET_API2_PROXY=$WALLET_API2_PROXY

COPY package.json package-lock.json* ./
COPY apps/waltid-dev-wallet/package.json ./apps/waltid-dev-wallet/
COPY libs ./libs
RUN npm install --workspace=@waltid-web-wallet-secdsa/dev-wallet

COPY apps/waltid-dev-wallet ./apps/waltid-dev-wallet
WORKDIR /app/apps/waltid-dev-wallet
RUN npm run build

FROM node:22-bookworm-slim AS release
WORKDIR /app
ARG NUXT_PUBLIC_APP_VERSION=DEV
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=7115 \
    NUXT_PUBLIC_APP_VERSION=$NUXT_PUBLIC_APP_VERSION \
    NUXT_PUBLIC_WSCA_ACCOUNT_ID=citizen-42 \
    NUXT_PUBLIC_WSCA_BASE_URL=http://secdsa:8080 \
    NUXT_PUBLIC_OIDC_CLIENT_ID= \
    NUXT_PUBLIC_OIDC_AUTHORIZE_URL=https://oidc.pilot1.sram.surf.nl/authorize \
    NUXT_PUBLIC_OIDC_REDIRECT_URI=http://localhost:7115/wallet-api/auth/oidc-session \
    NUXT_OIDC_TOKEN_URL=https://oidc.pilot1.sram.surf.nl/token \
    NUXT_PUBLIC_OIDC_SCOPES="openid email profile" \
    NUXT_PUBLIC_OID4VCI_CLIENT_ID=wallet-secdsa-demo \
    NUXT_PUBLIC_OID4VCI_REDIRECT_URI=http://localhost:7115/oid4vci/callback
COPY --from=build /app/apps/waltid-dev-wallet/.output ./
EXPOSE 7115
CMD ["node", "server/index.mjs"]
