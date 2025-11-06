# ===== deps =====
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Instalamos sin ejecutar scripts (evita prisma postinstall)
RUN npm ci --ignore-scripts

# ===== build =====
FROM node:20-alpine AS build
WORKDIR /app

# Traemos node_modules de deps
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# Prisma schema y client
COPY prisma ./prisma
# Dummy para prisma generate (no conecta a DB)
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate

# Código y build de Nest
COPY . .
RUN npm run build

# Dejamos solo dependencias de producción
RUN npm prune --omit=dev --ignore-scripts

# ===== runtime =====
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# Importamos artefactos y deps ya podadas
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist

# Railway expone 8080 por defecto; Nest leerá PORT
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/main.js"]
