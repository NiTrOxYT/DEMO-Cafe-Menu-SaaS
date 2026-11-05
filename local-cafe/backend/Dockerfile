# Multi-stage Dockerfile for Local Cafe Backend
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

# Production Stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node

EXPOSE 5000

CMD ["node", "dist/index.js"]

