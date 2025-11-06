# --- ETAPA DE BUILD ---
FROM node:20-alpine AS build

# 1) Copia la carpeta prisma y los archivos de dependencias
WORKDIR /app
COPY prisma ./prisma
COPY package*.json ./

# 2) Instala dependencias y arregla expo-server-sdk
# Se usa `npm ci` para instalaciones limpias y reproducibles
RUN npm pkg set dependencies.expo-server-sdk="^4.0.0" \
    && npm ci

# 3) Genera el cliente de Prisma para la arquitectura de build
RUN npx prisma generate

# 4) Copia todo el código fuente y compila
COPY . .
RUN npx tsc -p tsconfig.json

# --- ETAPA DE PRODUCCIÓN (Más pequeña y segura) ---
FROM node:20-alpine AS prod

# 5) Directorio de trabajo
WORKDIR /app

# 6) Copia solo el package.json y el package-lock.json (ya corregidos)
COPY --from=build /app/package*.json ./

# 7) Instala dependencias de producción y elimina `postinstall` de Prisma
# Usamos `npm ci --omit=dev` para reducir tamaño.
RUN npm pkg delete scripts.postinstall \
    && npm ci --omit=dev

# 8) Copia artefactos compilados y binarios de Prisma (necesarios para el runtime)
# COPIA CRÍTICA: Copia tsconfig.json para que tsconfig-paths pueda leer los aliases.
COPY --from=build /app/tsconfig.json ./
# Copia la carpeta 'dist'
COPY --from=build /app/dist ./dist
# Copia los binarios de Prisma para la arquitectura final
COPY --from=build /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/engines /app/node_modules/@prisma/engines

# 9) Expone el puerto y define el comando de inicio
EXPOSE 3000

# CMD usa el script `start:prod` del package.json, el cual incluye
# la carga de tsconfig-paths/register para resolver rutas absolutas.
CMD ["npm", "run", "start:prod"]