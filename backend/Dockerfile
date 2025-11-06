# ===== Build =====
FROM node:20-alpine AS build
WORKDIR /app

# (Opcional) cache-bust para forzar reinstalar deps cuando lo necesites
ARG CACHE_BUST=2025-11-06-02

# 1) Dependencias (usa lockfile)
COPY package*.json ./
RUN npm ci --ignore-scripts

# 2) Prisma Client (no requiere DB viva para 'generate')
COPY prisma ./prisma
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate

# 3) Copia el resto del código y compila a /app/dist
COPY . .
RUN npm run build   # @prisma/client ya existe con tipos

# ===== Runtime =====
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production

# Solo dependencias de producción (usa lockfile)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Artefactos compilados y binarios de Prisma para runtime
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "dist/main.js"]
