# ===== base =====
FROM node:20-alpine AS base
WORKDIR /app

# ===== build =====
FROM base AS build

# 1) Instalar deps SIN scripts (evita postinstall prisma generate)
COPY package*.json ./
RUN npm ci --ignore-scripts

# 2) Copiar schema y generar Prisma Client
COPY prisma ./prisma
# Dummy por si prisma requiere la var para `generate`
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate

# 3) Copiar código y compilar NestJS
COPY . .
RUN npm run build

# ===== runtime (prod) =====
FROM base AS prod
ENV NODE_ENV=production

# 4) Instalar deps de producción SIN scripts
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# 5) Copiar artefactos compilados y Prisma Client generado
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "dist/main.js"]
