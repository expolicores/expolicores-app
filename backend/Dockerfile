# ===== Build =====
FROM node:20-alpine AS build
WORKDIR /app

# Prisma: usar engine binario (no WASM) y tener OpenSSL en Alpine
ENV PRISMA_CLIENT_ENGINE_TYPE=binary \
    PRISMA_CLI_QUERY_ENGINE_TYPE=binary
RUN apk add --no-cache openssl

# 1) Dependencias
COPY package*.json ./
RUN npm ci

# 2) Copia SOLO el esquema primero y genera Prisma Client
COPY prisma ./prisma
# Prisma no necesita conectarse para generate; damos una DATABASE_URL dummy
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate

# 3) Copia el resto del código y compila a /app/dist
COPY . .
RUN npm run build   # ← ahora sí compila porque @prisma/client ya existe con tipos


# ===== Runtime =====
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production

# Prisma binario y OpenSSL también en runtime
ENV PRISMA_CLIENT_ENGINE_TYPE=binary \
    PRISMA_CLI_QUERY_ENGINE_TYPE=binary
RUN apk add --no-cache openssl

# Solo deps de producción
COPY package*.json ./
RUN npm ci --omit=dev

# Artefactos compilados y prisma (por si usas migraciones en runtime)
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "dist/main.js"]
