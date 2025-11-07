# ----------------------------------------------------------------------
# ETAPA 1: BUILD (Compilación y generación de artefactos)
# ----------------------------------------------------------------------
FROM node:20.19.0-alpine AS build

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar TODAS las dependencias (incluyendo devDependencies para la compilación)
RUN npm install

# Copiar el código fuente
COPY . .

# CRÍTICO: Compilar la aplicación
RUN npm run build

# CRÍTICO: Regenerar el cliente de Prisma (necesario para el build)
RUN npx prisma generate

# ----------------------------------------------------------------------
# ETAPA 2: PRODUCTION (Imagen final de ejecución)
# ----------------------------------------------------------------------
FROM node:20.19.0-alpine AS production

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# CRÍTICO: Instalar SOLO dependencias de producción, IGNORANDO SCRIPTS.
# Esto previene que 'npx prisma generate' falle aquí, ya que el cliente
# generado en la etapa 'build' será copiado posteriormente.
RUN npm install --only=production --ignore-scripts

# CRÍTICO: Copiar la carpeta compilada (dist) desde la etapa 'build'
COPY --from=build /app/dist ./dist

# CRÍTICO: Copiar el cliente binario de Prisma y el esquema desde la etapa 'build'
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/prisma ./prisma

# Exponer el puerto
EXPOSE 3000

# Comando de inicio
CMD [ "npm", "run", "start:prod" ]