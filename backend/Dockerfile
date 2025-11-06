# ===== Base =====
FROM node:20-alpine AS base
WORKDIR /app

# ===== Build stage =====
FROM base AS build

# 1) Dependencias
COPY package*.json ./
RUN npm ci

# 2) Prisma schema y generar Prisma Client
COPY prisma ./prisma
# Si tu build requiere DATABASE_URL para generate, puedes setear un dummy:
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate

# 3) Copiar código y compilar Nest
COPY . .
RUN npm run build

# ===== Runtime stage =====
FROM base AS prod
ENV NODE_ENV=production

# Copiamos package.json/lock para instalar deps prod
COPY package*.json ./

# Copiamos el schema (por si corres migraciones o lo necesitas para diagnósticos)
COPY prisma ./prisma

# 4) Instalar solo deps de producción **sin scripts** (evita postinstall prisma generate)
RUN npm ci --omit=dev --ignore-scripts

# 5) Artefactos del build y Prisma Client generado en la etapa build
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "dist/main.js"]
