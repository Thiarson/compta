FROM node:24-slim AS base
# pnpm version comes from "packageManager" in package.json
RUN corepack enable
WORKDIR /app

# Keep only the api workspace and what it depends on
FROM base AS prune
RUN npm install -g turbo@2.10.0
COPY . .
RUN turbo prune api --docker

FROM base AS build
# Install deps first so this layer is cached until the lockfile changes
COPY --from=prune /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prune /app/out/full/ .
# esbuild only: the full "build" script runs tsc, which fails on a pruned workspace. Type checking is done in CI.
RUN pnpm --filter=api exec node build.js
# Production node_modules only (needed at runtime, build.js keeps them external)
RUN pnpm --filter=api deploy --legacy --prod /prod/api

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /prod/api/node_modules ./node_modules
# package.json is required: its "type": "module" makes Node load dist as ESM
COPY --from=build --chown=node:node /prod/api/package.json ./package.json
COPY --from=build --chown=node:node /app/apps/api/dist ./dist
USER node
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:8000/healthz').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
# Exec form: node is PID 1 and receives SIGTERM for a graceful shutdown
CMD ["node", "dist/server.js"]
