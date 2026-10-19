# SECDSA PIN web wallet (Nuxt) → wallet-api2 + SECDSA key store.
#
# Layering notes:
# - Install deps before any frequently changing ARG/ENV (e.g. APP_VERSION) so
#   npm stays cacheable across commits.
# - Runtime OIDC/WSCA values are applied from container env at startup
#   (see oidc-env.server.ts); they need not be baked into the build.

FROM node:22-bookworm AS build
WORKDIR /app

# Dependency install — only invalidated when lockfiles / package.json change.
# package-lock.json must be committed (was previously gitignored → npm ci failed in CI).
COPY package.json package-lock.json ./
COPY apps/waltid-dev-wallet/package.json ./apps/waltid-dev-wallet/
RUN npm ci --workspace=@waltid-web-wallet-secdsa/dev-wallet --include-workspace-root

COPY libs ./libs
COPY apps/waltid-dev-wallet ./apps/waltid-dev-wallet

# App version is the only build-time bake-in (corner ribbon). Keep it after npm ci.
ARG APP_VERSION=DEV
ENV APP_VERSION=$APP_VERSION \
    NODE_ENV=production

WORKDIR /app/apps/waltid-dev-wallet
RUN npm run build

FROM node:22-bookworm-slim AS release
WORKDIR /app
ARG APP_VERSION=DEV
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=7115 \
    APP_VERSION=$APP_VERSION
COPY --from=build /app/apps/waltid-dev-wallet/.output ./
EXPOSE 7115
CMD ["node", "server/index.mjs"]
