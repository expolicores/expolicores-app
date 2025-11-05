# ========== Builder ==========
FROM node:20-alpine AS builder
WORKDIR /app

# 1) Dependencias de dev (incluye nest cli)
COPY package*.json ./
RUN npm ci

# 2) Prisma client (tipos) antes del build
COPY prisma ./prisma
# Var dummy para permitir "prisma generate" sin DB real
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
RUN npx prisma generate

# 3) Código y build
COPY . .
# Compila a /app/dist
RUN npm run build

# 4) Sanity check: debe existir dist/main.js
RUN test -f dist/main.js || (echo "❌ dist/main.js NO existe" && ls -la && ls -la dist || true && exit 1)

# ========== Runtime ==========
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copiamos solo lo necesario
COPY package*.json ./
RUN npm ci --omit=dev

# Artefactos del build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Prisma runtime (cliente ya viene en node_modules)
# Si por alguna razón faltara .prisma, descomenta las 2 líneas siguientes:
# COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Sanity check: dist/main.js existe en runtime
RUN test -f dist/main.js || (echo "❌ dist/main.js NO está en runtime" && ls -la && ls -la dist || true && exit 1)

EXPOSE 3000
CMD ["node", "dist/main.js"]
