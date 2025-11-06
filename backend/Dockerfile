# --- ETAPA DE BUILD ---
FROM node:20-alpine AS build

# 1) Dependencias y Prisma Client
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma

# Instalación limpia sin scripts (evita postinstall)
RUN npm ci --ignore-scripts

# Genera Prisma Client para esta arquitectura
RUN npx prisma generate

# 2) Compilación (Nest → dist/)
COPY . .
RUN npm run build

# --- ETAPA DE PRODUCCIÓN ---
FROM node:20-alpine AS prod
ENV NODE_ENV=production
WORKDIR /app

# 3) Solo deps de producción (sin postinstall)
COPY --from=build /app/package*.json ./
RUN npm pkg delete scripts.postinstall \
  && npm ci --omit=dev --ignore-scripts

# 4) Artefactos necesarios en runtime
COPY --from=build /app/dist ./dist
# Binarios de Prisma (query engines) generados en build
COPY --from=build /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/engines /app/node_modules/@prisma/engines

# 5) Arranque
EXPOSE 3000
# Ejecuta el script que ahora NO usa tsconfig-paths (equivale a: node dist/main.js)
CMD ["npm", "run", "start:prod"]
