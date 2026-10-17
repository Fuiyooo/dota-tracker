# Build context adalah root repo (lihat docker-compose.yml).
FROM node:22-alpine AS build
RUN npm i -g pnpm@12.11.2
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

COPY . .
# @dota/shared harus dibangun dulu: FE mengimpor RANK_MEDALS darinya.
RUN pnpm --filter @dota/shared build \
 && pnpm --filter @dota/web build

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
