# =========================
# ===== base (común) =====
# =========================
FROM node:20-alpine AS base
WORKDIR /app

# (Prisma en Alpine requiere OpenSSL en runtime)
# Lo instalamos sólo en el contenedor final, pero lo dejamos aquí por si
# necesitas usarlo en build. Puedes comentarlo si no te hace falta en build.
RUN apk add --no-cache openssl

# =========================
# ====== build stage ======
# =========================
FROM base AS build

# 👇 cache-bust: cambia el valor cuando quieras forzar build limpio
ARG CACHE_BUST=1
RUN echo "Cache bust: $CACHE_BUST"

# 1) Instalar dependencias SIN scripts para evitar postinstall (prisma generate)
COPY package*.json ./
RUN npm ci --ignore-scripts

# 2) Copiar schema y generar Prisma Client (sin conectar a DB)
COPY prisma ./prisma
# Prisma a veces exige la var aunque no conecte
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate

# 3) Copiar el resto del código y compilar NestJS a /app/dist
COPY . .
RUN npm run build

# =========================
# ===== runtime (prod) ====
# =========================
FROM base AS prod
ENV NODE_ENV=production

# 4) Instalar SOLO deps de producción SIN scripts
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# 5) Copiar artefactos compilados y Prisma Client ya generado
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "dist/main.js"]
