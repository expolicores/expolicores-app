# ===== Build =====
FROM node:20-alpine AS build
WORKDIR /app

# Fijar NPM 10 y opciones seguras
RUN corepack enable && corepack prepare npm@10.8.2 --activate
ENV NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_WORKSPACES=false

# 1) Dependencias
COPY package*.json ./
RUN npm ci

# 2) Prisma Client
COPY prisma ./prisma
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate

# 3) Código + build
COPY . .
RUN npm run build

# ===== Runtime =====
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production

# Fijar NPM 10 también en runtime (para coherencia con lock)
RUN corepack enable && corepack prepare npm@10.8.2 --activate
ENV NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_WORKSPACES=false

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "dist/main.js"]
