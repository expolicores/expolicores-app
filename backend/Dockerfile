# ---- Single-stage build+run (simple y fiable) ----
FROM node:20-alpine

WORKDIR /app

# 1) Dependencias SIN scripts (evita postinstall)
COPY package*.json ./
RUN npm ci --ignore-scripts

# 2) Prisma Client (necesita el schema en la imagen)
COPY prisma ./prisma
# variable dummy por si Prisma la pide al generar
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate

# 3) Código y build de Nest a /app/dist
COPY . .
RUN npm run build

# 4) Preparar runtime
ENV NODE_ENV=production
# deja solo deps de prod, otra vez sin scripts
RUN npm prune --omit=dev --ignore-scripts

EXPOSE 3000
CMD ["node", "dist/main.js"]
