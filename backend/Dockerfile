# ===== Build =====
FROM node:20-alpine AS build
WORKDIR /app

# Motores binarios de Prisma (evita WASM/descargas extra)
ENV PRISMA_CLIENT_ENGINE_TYPE=binary \
    PRISMA_CLI_QUERY_ENGINE_TYPE=binary

# 1) Copia manifiestos
COPY package*.json ./

# 2) Añade expo-server-sdk al package.json y regenera lockfile de forma reproducible
#    - npm pkg set: modifica package.json dentro de la imagen
#    - npm install --package-lock-only: recalcula lock sin instalar
#    - npm ci: instala EXACTAMENTE lo del lock
RUN npm pkg set dependencies.expo-server-sdk="^4.0.0" \
  && npm install --package-lock-only \
  && npm ci

# 3) Copia SOLO prisma y genera el client antes del build
COPY prisma ./prisma
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate --schema=prisma/schema.prisma

# 4) Copia el resto del código y compila
COPY . .
RUN npm run build

# ===== Runtime =====
FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
ENV PRISMA_CLIENT_ENGINE_TYPE=binary

# 5) Usa el MISMO package.json y lockfile que quedaron en build (ya incluyen expo-server-sdk)
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev

# 6) Copia artefactos compilados y binarios de Prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "dist/main.js"]
