# ===== Build =====
FROM node:20-alpine AS build
WORKDIR /app

# 1) Manter npm estable (opcional, ya lo probaste)
RUN corepack enable && corepack prepare npm@10.8.2 --activate
ENV NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false NPM_CONFIG_WORKSPACES=false

# 2) Copia manifests + schema ANTES de instalar
COPY package*.json ./
COPY prisma ./prisma

# 3) Dependencias (postinstall de @prisma/client ya ve el schema)
RUN npm ci

# 4) (Opcional, pero yo lo dejo) forzar generate explícito
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate

# 5) Código + build
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
