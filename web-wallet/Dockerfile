# SECDSA PIN web wallet (Nuxt) → wallet-api2 + SECDSA key store.
FROM node:22-bookworm AS build
WORKDIR /app

ARG APP_VERSION=DEV
ARG WSCA_ACCOUNT_ID=citizen-42
ARG WSCA_INTERNAL_URL=http://secdsa:8080
ARG WALLET_API2_PROXY=http://wallet-api2:7006
ARG OIDC_CLIENT_ID=
ARG OIDC_AUTHORIZE_URL=https://oidc.pilot1.sram.surf.nl/authorize
ARG OIDC_REDIRECT_URI=http://localhost:7115/wallet-api/auth/oidc-session
ARG OIDC_TOKEN_URL=https://oidc.pilot1.sram.surf.nl/token
ARG OIDC_BASE_URL=http://localhost:7115
ARG OIDC_SCOPES="openid email profile"
ARG OID4VCI_CLIENT_ID=wallet-secdsa-demo
ARG OID4VCI_REDIRECT_URI=http://localhost:7115/oid4vci/callback
ENV APP_VERSION=$APP_VERSION \
    WSCA_ACCOUNT_ID=$WSCA_ACCOUNT_ID \
    WSCA_INTERNAL_URL=$WSCA_INTERNAL_URL \
    OIDC_CLIENT_ID=$OIDC_CLIENT_ID \
    OIDC_AUTHORIZE_URL=$OIDC_AUTHORIZE_URL \
    OIDC_REDIRECT_URI=$OIDC_REDIRECT_URI \
    OIDC_TOKEN_URL=$OIDC_TOKEN_URL \
    OIDC_BASE_URL=$OIDC_BASE_URL \
    OIDC_SCOPES=$OIDC_SCOPES \
    OID4VCI_CLIENT_ID=$OID4VCI_CLIENT_ID \
    OID4VCI_REDIRECT_URI=$OID4VCI_REDIRECT_URI \
    WALLET_API2_PROXY=$WALLET_API2_PROXY

COPY package.json package-lock.json* ./
COPY apps/waltid-dev-wallet/package.json ./apps/waltid-dev-wallet/
RUN npm install --workspace=@waltid-web-wallet-secdsa/dev-wallet

# Copy source after install so that code changes don't bust the npm cache layer.
COPY libs ./libs
COPY apps/waltid-dev-wallet ./apps/waltid-dev-wallet
WORKDIR /app/apps/waltid-dev-wallet
RUN npm run build

FROM node:22-bookworm-slim AS release
WORKDIR /app
ARG APP_VERSION=DEV
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=7115 \
    APP_VERSION=$APP_VERSION \
    WSCA_ACCOUNT_ID=citizen-42 \
    WSCA_INTERNAL_URL=http://secdsa:8080 \
    OIDC_CLIENT_ID= \
    OIDC_AUTHORIZE_URL=https://oidc.pilot1.sram.surf.nl/authorize \
    OIDC_REDIRECT_URI=http://localhost:7115/wallet-api/auth/oidc-session \
    OIDC_TOKEN_URL=https://oidc.pilot1.sram.surf.nl/token \
    OIDC_BASE_URL=http://localhost:7115 \
    OIDC_SCOPES="openid email profile" \
    OID4VCI_CLIENT_ID=wallet-secdsa-demo \
    OID4VCI_REDIRECT_URI=http://localhost:7115/oid4vci/callback
COPY --from=build /app/apps/waltid-dev-wallet/.output ./
EXPOSE 7115
CMD ["node", "server/index.mjs"]
