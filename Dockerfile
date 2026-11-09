# Compra: compila la web (Vue) y la sirve junto a la API (Node + Hono) en un solo contenedor.
# Producción: deploy/compose.yml (ver deploy/README.md). La imagen base va fijada por digest; Dependabot la actualiza.

# ---- 1. web
FROM node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web ./
RUN npm run build

# ---- 2. dependencias del servidor (sin las de desarrollo)
FROM node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS deps
WORKDIR /srv/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---- 3. imagen final: solo lo necesario para ejecutar
FROM node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8
ENV NODE_ENV=production \
    TZ=Europe/Madrid \
    PORT=8790 \
    STATIC_DIR=web \
    NODE_NO_WARNINGS=1
WORKDIR /srv
COPY --from=deps /srv/server/node_modules server/node_modules
COPY server/package.json server/
COPY server/src server/src
COPY server/migrations server/migrations
COPY --from=web /src/web/dist web
EXPOSE 8790
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1:8790/v1/health || exit 1
USER node
CMD ["node", "server/src/index.js"]
