# STAGE 1: Build (Compilación)
FROM node:20-alpine AS build

# Variables de entorno para NPM
ENV NPM_CONFIG_LOGLEVEL warn

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos de configuración
COPY package*.json ./
COPY prisma ./prisma

# 1) Añade dependencias de Expo y instala todo
RUN npm pkg set dependencies.expo-server-sdk="^4.0.0" \
    && npm ci

# 2) Genera el Prisma Client (obligatorio para la compilación)
RUN npx prisma generate

# 3) Copia el código fuente
COPY . .

# 4) Compila el código TypeScript a JavaScript (usa el tsconfig.json)
RUN npx tsc -p tsconfig.json

# STAGE 2: Runtime (Producción)
FROM node:20-alpine AS prod

# Establece el directorio de trabajo
WORKDIR /app

# 5) Copia package.json y lockfile (con todas las dependencias)
COPY --from=build /app/package*.json ./

# 6A) ELIMINA el script 'postinstall' para evitar que 'prisma generate' falle
RUN npm pkg delete scripts.postinstall

# 6B) Instala solo dependencias de producción.
RUN npm ci --omit=dev

# 7) Copia artefactos compilados y binarios de Prisma (necesarios para el runtime)
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Expone el puerto (si tu app usa 3000)
EXPOSE 3000

# Comando de inicio: Usa la ruta relativa completa a tsconfig-paths/register para evitar el error MODULE_NOT_FOUND.
CMD ["node", "-r", "./node_modules/tsconfig-paths/register", "dist/main.js"]