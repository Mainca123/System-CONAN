# syntax=docker/dockerfile:1
# Build context: repository root (.)
# Example: docker build -f frontend/Dockerfile -t conan-frontend .

FROM node:22-alpine AS build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine

ENV PORT=80 \
    CATALOG_URL=http://catalog:8081 \
    ORDERS_URL=http://orders:8082 \
    ASSISTANT_URL=http://assistant:8083 \
    IDENTITY_URL=http://localhost:8181 \
    NGINX_ENVSUBST_FILTER="^(PORT|CATALOG_URL|ORDERS_URL|ASSISTANT_URL)$"

COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY frontend/docker-entrypoint.d/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh

RUN sed -i 's/\r$//' /docker-entrypoint.d/40-runtime-config.sh \
    && chmod +x /docker-entrypoint.d/40-runtime-config.sh

EXPOSE 80
