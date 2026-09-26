FROM oven/bun:1.3 AS deps
WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
COPY apps/proxy/package.json apps/proxy/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3 AS runtime
WORKDIR /app

RUN groupadd --system --gid 1001 travely && useradd --system --uid 1001 --gid travely travely

COPY --from=deps /app/node_modules node_modules
COPY package.json bun.lock bunfig.toml ./
COPY packages/shared packages/shared
COPY apps/proxy apps/proxy
COPY fixtures fixtures

ENV DATA_DIR=/app/apps/proxy/data
RUN mkdir -p /app/apps/proxy/data && chown -R travely:travely /app

USER travely
EXPOSE 8787
CMD ["bun", "apps/proxy/src/index.ts"]
