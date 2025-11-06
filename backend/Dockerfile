# STAGE 1: Build (Compilación)
FROM node:20-alpine AS build

# Variables de entorno para NPM
ENV NPM_CONFIG_LOGLEVEL warn

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copia los archivos de configuración
COPY package*.json ./
COPY prisma ./prisma

# 1) Añade dependencias de Expo y TSConfig-paths e instala
# Usamos 'npm ci' porque ya tenemos un lockfile.
# 'tsconfig-paths' debe estar en 'dependencies' en package.json.
RUN npm pkg set dependencies.expo-server-sdk="^4.0.0" \
    && npm ci

# 2) Genera el Prisma Client (obligatorio para la compilación)
RUN npx prisma generate

# 3) Copia el código fuente
COPY . .

# 4) Compila el código TypeScript a JavaScript (usa el tsconfig.json)
# El comando tsc con la configuración correcta resuelve las rutas a 'dist/...'
RUN npx tsc -p tsconfig.json

# STAGE 2: Runtime (Producción)
FROM node:20-alpine AS prod

# Establece el directorio de trabajo
WORKDIR /app

# 5) Copia package.json y lockfile (con tsconfig-paths incluido)
COPY --from=build /app/package*.json ./

# 6) Instala solo dependencias de producción.
# Esto incluye 'tsconfig-paths' y 'expo-server-sdk' si están en 'dependencies'.
# No necesitamos eliminar el postinstall aquí, ya que no copiamos el prisma/schema.prisma, 
# pero nos aseguramos de que no se ejecute copiando solo los archivos JS compilados.
RUN npm ci --omit=dev

# 7) Copia artefactos compilados y binarios de Prisma (necesarios para el runtime)
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Expone el puerto (si tu app usa 3000)
# Esto es opcional, pero buena práctica.
EXPOSE 3000

# Comando de inicio: Usa tsconfig-paths/register para resolver los alias 'src/'
# Se asume que tu archivo principal es main.js en la carpeta dist.
CMD ["node", "-r", "tsconfig-paths/register", "dist/main.js"]