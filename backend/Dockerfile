# ----------------------------------------------------------------------
# ETAPA 1: BUILD (Compilación y generación de artefactos)
# ----------------------------------------------------------------------
# Utilizamos una imagen Node base para instalar dependencias de desarrollo y compilar.
FROM node:20.19.0-alpine AS build

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar package.json y package-lock.json (o yarn.lock) para instalar dependencias.
COPY package*.json ./

# Instalar TODAS las dependencias (incluyendo devDependencies para la compilación)
RUN npm install

# Copiar el código fuente
COPY . .

# CRÍTICO: Compilar la aplicación
RUN npm run build

# CRÍTICO: Regenerar el cliente de Prisma para que esté listo en la imagen.
# Esto asegura que el cliente binario coincida con el entorno Alpine del Docker.
# Además, si has hecho cambios en el esquema como los de Promotions, esto lo asegura.
RUN npx prisma generate

# ----------------------------------------------------------------------
# ETAPA 2: PRODUCTION (Imagen final de ejecución)
# ----------------------------------------------------------------------
# Utilizamos una imagen Node más limpia y pequeña para la ejecución final
FROM node:20.19.0-alpine AS production

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar solo los archivos necesarios para la ejecución
COPY package*.json ./

# Instalar SOLO dependencias de producción (más ligero)
RUN npm install --only=production

# CRÍTICO: Copiar la carpeta compilada (dist) desde la etapa 'build'
COPY --from=build /app/dist ./dist

# CRÍTICO: Copiar el cliente binario de Prisma y el esquema desde la etapa 'build'
# Esto es esencial para que Prisma pueda conectarse a la DB en runtime.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/prisma ./prisma

# Exponer el puerto
EXPOSE 3000

# Comando de inicio
# Usamos el script start:prod simplificado que ya corregimos.
CMD [ "npm", "run", "start:prod" ]