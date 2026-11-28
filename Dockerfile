FROM node:22-bookworm-slim@sha256:be979e5523c76fa4d5ca4ebd3099078f220aa47ec39c48ad5b5df9314debd6eb AS base

WORKDIR /app

# Upgrade on top of the pinned digest so fixed bookworm packages (libpam, libzstd) are installed.
RUN apt-get update \
  && apt-get upgrade -y --no-install-recommends \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS prod-deps
COPY package.json package-lock.json ./
# The generated client does not need the Prisma CLI. Drop it so its parser dependencies are not in the runtime image.
RUN npm ci --omit=dev && npm cache clean --force \
  && rm -rf \
    node_modules/prisma \
    node_modules/@prisma/config \
    node_modules/@prisma/engines \
    node_modules/@prisma/debug \
    node_modules/@prisma/fetch-engine \
    node_modules/@prisma/get-platform \
    node_modules/effect \
    node_modules/deepmerge-ts \
    node_modules/c12 \
    node_modules/empathic

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM builder AS migrate
CMD ["npx", "prisma", "migrate", "deploy"]

FROM base AS runner
ENV PORT=3000
# next start is invoked with node. The npm CLI and its dependency tree are not needed at runtime.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package.json next.config.mjs ./
COPY prisma ./prisma
COPY scripts/docker-start.mjs scripts/init-dev-secrets.mjs ./scripts/
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/docker-start.mjs"]
