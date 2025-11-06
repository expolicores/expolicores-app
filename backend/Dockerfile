# ===== Build =====
FROM node:20-alpine AS build
WORKDIR /app

# 0) (opcional) asegurar engine binario
ENV PRISMA_CLIENT_ENGINE_TYPE=binary \
    PRISMA_CLI_QUERY_ENGINE_TYPE=binary

# 1) Dependencias base
COPY package*.json ./
# 2) Prisma primero (para que generate tenga schema)
COPY prisma ./prisma

# 3) Instalar deps
RUN npm ci

# 4) Generar Prisma Client (no requiere DB real)
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate --schema=prisma/schema.prisma

# 5) Copiar código y compilar
COPY . .
RUN npm run build

# ===== Runtime =====
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV PRISMA_CLIENT_ENGINE_TYPE=binary

# Solo deps de producción
COPY package*.json ./
RUN npm ci --omit=dev

# Artefactos compilados y prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "dist/main.js"]
