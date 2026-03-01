FROM node:20-alpine AS builder
WORKDIR /app
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npm config set registry https://registry.npmmirror.com && npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
COPY --from=builder /app/package.json ./
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
