# ===== Build =====
FROM node:20-alpine AS build
WORKDIR /app

# (opcional) fija npm 10 para evitar rarezas de cli
RUN corepack enable && corepack prepare npm@10.8.2 --activate
ENV NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false NPM_CONFIG_WORKSPACES=false

# 1) Manifiestos + SCHEMA ANTES de instalar (clave para @prisma/client postinstall)
COPY package*.json ./
COPY prisma ./prisma

# 2) Dependencias
RUN npm ci

# 3) Generar Prisma Client ya con schema presente
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate

# 4) Código + build
COPY . .
RUN npm run build

# ===== Runtime =====
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare npm@10.8.2 --activate
ENV NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false NPM_CONFIG_WORKSPACES=false

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node","dist/main.js"]
