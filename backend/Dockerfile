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

# 2) COPIA EL ESQUEMA DE PRISMA AHORA (CLAVE)
# Esto asegura que el esquema esté presente en /app/prisma/schema.prisma
# antes de que 'npm ci' ejecute el 'postinstall' de Prisma.
COPY prisma ./prisma

# 3) Añade expo-server-sdk y regenera lockfile de forma reproducible
# El comando 'npm ci' instalará dependencias y generará el Prisma Client (implícito)
RUN npm pkg set dependencies.expo-server-sdk="^4.0.0" \
  && npm install --package-lock-only \
  && npm ci

# 4) Copia el resto del código y COMPILA usando TSC.
# Usamos 'npx tsc' en lugar de 'npm run build' para garantizar que se cree 'dist'
COPY . .
RUN npx tsc -p tsconfig.json

# ==================================
# ===== STAGE 2: Runtime (Entorno de Producción) =====
# ==================================
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV PRISMA_CLIENT_ENGINE_TYPE=binary

# 5) Usa el MISMO package.json y lockfile que quedaron en build
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev

# 6) Copia artefactos compilados y binarios de Prisma
# La carpeta 'dist' contiene el prisma.service.js compilado.
COPY --from=build /app/dist ./dist

# Copia los binarios generados y el cliente de Prisma.
# Esto incluye los motores de consulta necesarios.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "dist/main.js"]