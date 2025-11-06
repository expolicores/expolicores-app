# ===== Build =====
FROM node:20-alpine AS build
WORKDIR /app

# (opcional pero recomendable) fija npm 10 para evitar EUSAGE
RUN corepack enable && corepack prepare npm@10.8.2 --activate
ENV NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false NPM_CONFIG_WORKSPACES=false

# Prisma: forzar motor BINARIO y tener OpenSSL en Alpine
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary \
    PRISMA_CLIENT_ENGINE_TYPE=binary
RUN apk add --no-cache openssl

# 1) Manifiestos + schema ANTES de instalar (para postinstall de @prisma/client)
COPY package*.json ./
COPY prisma ./prisma

# 2) Dependencias
RUN npm ci

# 3) Generate (con DATABASE_URL dummy)
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate

# 4) Código + build
COPY . .
RUN npm run build

# ===== Runtime =====
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production

# Misma versión de npm (coherencia con lock)
RUN corepack enable && corepack prepare npm@10.8.2 --activate
ENV NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false NPM_CONFIG_WORKSPACES=false

# Prisma binario y OpenSSL en runtime
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary \
    PRISMA_CLIENT_ENGINE_TYPE=binary
RUN apk add --no-cache openssl

# Solo deps prod
COPY package*.json ./
RUN npm ci --omit=dev

# Artefactos
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node","dist/main.js"]
