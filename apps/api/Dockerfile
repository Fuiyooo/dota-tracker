# Build context adalah root repo (lihat docker-compose.yml).
FROM node:22-alpine AS build
RUN npm i -g pnpm@12.11.2
WORKDIR /app

# Salin manifest dulu supaya layer install bisa di-cache.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @dota/shared build \
 && pnpm --filter @dota/api build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Seluruh workspace ikut disalin agar symlink node_modules (workspace) tetap valid.
# Ukuran image belum dioptimalkan (devDependencies masih terbawa).
COPY --from=build /app /app

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "apps/api/dist/index.js"]
