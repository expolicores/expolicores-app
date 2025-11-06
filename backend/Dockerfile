# ==================================
# ===== STAGE 1: Build (Genera 'dist' y Prisma Client) =====
# ==================================
FROM node:20-alpine AS build
WORKDIR /app

# Motores binarios de Prisma (Optimización para entornos estables como Alpine)
ENV PRISMA_CLIENT_ENGINE_TYPE=binary \
    PRISMA_CLI_QUERY_ENGINE_TYPE=binary

# 1) Copia manifiestos
COPY package*.json ./

# 2) Añade expo-server-sdk y regenera lockfile de forma reproducible
# - npm pkg set: modifica package.json dentro de la imagen
# - npm install --package-lock-only: recalcula lock sin instalar
# - npm ci: instala EXACTAMENTE lo del lock
RUN npm pkg set dependencies.expo-server-sdk="^4.0.0" \
  && npm install --package-lock-only \
  && npm ci

# 3) Copia SOLO prisma y genera el client antes del build
COPY prisma ./prisma
# Eliminamos ENV DATABASE_URL de aquí, solo es necesario en runtime.
RUN npx prisma generate --schema=prisma/schema.prisma

# 4) Copia el resto del código y COMPILA usando TSC.
# Usamos 'npx tsc' en lugar de 'npm run build' para asegurar la creación de la carpeta 'dist'
COPY . .
RUN npx tsc -p tsconfig.json

# ==================================
# ===== STAGE 2: Runtime (Entorno de Producción) =====
# ==================================
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV PRISMA_CLIENT_ENGINE_TYPE=binary

# 5) Usa el MISMO package.json y lockfile que quedaron en build (ya incluyen expo-server-sdk)
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev

# 6) Copia artefactos compilados y binarios de Prisma
# La carpeta 'dist' ahora contiene el prisma.service.js compilado.
COPY --from=build /app/dist ./dist

# EXCLUIMOS la copia de /app/prisma (solo esquema) para producción.

# Copia los binarios generados y el cliente de Prisma.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "dist/main.js"]