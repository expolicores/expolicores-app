# ===== Build Stage =====
FROM node:20-alpine AS build
WORKDIR /app

# Motores binarios de Prisma
ENV PRISMA_CLIENT_ENGINE_TYPE=binary \
    PRISMA_CLI_QUERY_ENGINE_TYPE=binary

# 1) Copia manifiestos
COPY package*.json ./

# 2) Instala dependencias (incluyendo expo-server-sdk que se añade)
# NOTA: Asegúrate de que expo-server-sdk esté en package.json antes de la copia, 
# o usa npm pkg set si es necesario. Para simplicidad, asumo que ya está.
# Si el script 'npm pkg set' funciona, déjalo, si no, añádelo a package.json antes.
RUN npm pkg set dependencies.expo-server-sdk="^4.0.0" \
  && npm install --package-lock-only \
  && npm ci

# 3) Copia SOLO prisma y genera el client antes del build principal
COPY prisma ./prisma
# No establecemos DATABASE_URL aquí, Railway inyectará la real en runtime.
RUN npx prisma generate

# 4) Copia el resto del código y compila (debe compilar src/prisma/prisma.service.ts)
COPY . .
# Verifica que este script genere dist/prisma/prisma.service.js
RUN npm run build

# ===== Runtime Stage =====
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV PRISMA_CLIENT_ENGINE_TYPE=binary

# 5) Instala dependencias de producción
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev

# 6) Copia artefactos compilados y binarios de Prisma CLAVE
# Este paso copia el .js compilado de tu servicio de Prisma
# La ruta debe coincidir con donde 'npm run build' lo coloca.
# SI EL ERROR ES ESTE, ES PORQUE EL COMPILADOR NO ESTÁ METIENDO EL ARCHIVO EN DIST
COPY --from=build /app/dist ./dist 

# Copia los binarios generados por Prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000
CMD ["node", "dist/main.js"]