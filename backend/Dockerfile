# ==================================
# ===== STAGE 1: Build (Genera 'dist' y Prisma Client) =====
# ==================================
FROM node:20-alpine AS build
WORKDIR /app

# Motores binarios de Prisma (Optimización)
ENV PRISMA_CLIENT_ENGINE_TYPE=binary \
    PRISMA_CLI_QUERY_ENGINE_TYPE=binary

# 1) Copia manifiestos
COPY package*.json ./

# 2) COPIA EL ESQUEMA DE PRISMA (CLAVE: debe ser ANTES de npm ci)
COPY prisma ./prisma

# 3) INSTALACIÓN DE DEPENDENCIAS
# A) Añade expo-server-sdk
RUN npm pkg set dependencies.expo-server-sdk="^4.0.0"

# B) Instala todas las dependencias
RUN npm ci

# 4) GENERACIÓN EXPLÍCITA DEL PRISMA CLIENT
RUN npx prisma generate

# 5) Copia el resto del código y COMPILA usando el comando de NestJS (npm run build).
# Como ya resolvimos todos los errores de Prisma y dependencias, este debería pasar.
COPY . .
RUN npm run build

# ==================================
# ===== STAGE 2: Runtime (Entorno de Producción) =====
# ==================================
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV PRISMA_CLIENT_ENGINE_TYPE=binary

# 6) CONFIGURACIÓN DE PRODUCCIÓN Y DESACTIVACIÓN DEL POSTINSTALL
# A) Copia package.json y lockfile desde la etapa de build
COPY --from=build /app/package*.json ./

# B) ELIMINA el script 'postinstall' de package.json. 
RUN npm pkg delete scripts.postinstall

# C) Instala solo dependencias de producción (usando el package.json modificado)
RUN npm ci --omit=dev

# 7) Copia artefactos compilados y binarios de Prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "dist/main.js"]