# Multi-stage Dockerfile for Local Cafe Frontend (Vite + Nginx)
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json tsconfig.json vite.config.ts index.html ./
RUN npm install

COPY public ./public
COPY src ./src

RUN npm run build

# Nginx Production Stage
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

