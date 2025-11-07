# ----------------------------------------------------------------------
# ETAPA 1: BUILD (Compilación y generación de artefactos)
# ----------------------------------------------------------------------
FROM node:20.19.0-alpine AS build

# Establecer el directorio de trabajo
WORKDIR /app

# 1. Copiar package.json y package-lock.json
COPY package*.json ./

# 2. CRÍTICO: Copiar la carpeta 'prisma' ANTES de instalar.
# Esto es necesario para que el script 'postinstall' pueda encontrar el schema.
COPY prisma ./prisma

# 3. Instalar TODAS las dependencias (incluyendo devDependencies para la compilación)
# Ahora 'npm install' ejecuta 'prisma generate' sin error.
RUN npm install

# 4. Copiar el resto del código fuente
COPY . .

# 5. CRÍTICO: Compilar la aplicación
RUN npm run build

# ----------------------------------------------------------------------
# ETAPA 2: PRODUCTION (Imagen final de ejecución)
# ----------------------------------------------------------------------
FROM node:20.19.0-alpine AS production

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar SOLO dependencias de producción, IGNORANDO SCRIPTS.
# Ignoramos postinstall para que Prisma no intente regenerar binarios innecesariamente.
RUN npm install --only=production --ignore-scripts

# CRÍTICO: Copiar la carpeta compilada (dist) desde la etapa 'build'
COPY --from=build /app/dist ./dist

# CRÍTICO: Copiar el cliente binario de Prisma y el esquema desde la etapa 'build'
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/prisma ./prisma

# Exponer el puerto
EXPOSE 3000

# Comando de inicio (usa el script simplificado en package.json)
CMD [ "npm", "run", "start:prod" ]