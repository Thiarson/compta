FROM node:24-slim AS base
# pnpm version comes from "packageManager" in package.json
RUN corepack enable
WORKDIR /app

# Keep only the web workspace and what it depends on
FROM base AS prune
RUN npm install -g turbo@2.10.0
COPY . .
RUN turbo prune web --docker

FROM base AS build
# Install deps first so this layer is cached until the lockfile changes
COPY --from=prune /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prune /app/out/full/ .
# Root file outside any workspace, so turbo prune skips it but tsconfigs extend it
COPY tsconfig.base.json .
# Vite inlines VITE_* at build time, so the API URL is fixed per image
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL
# vite build only: the full "build" script runs tsc, which is done in CI
RUN pnpm --filter=web exec vite build

# Static files only: no Node in the final image
# Unprivileged nginx: non-root user, listens on 8080
FROM nginx/nginx-unprivileged:stable-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
