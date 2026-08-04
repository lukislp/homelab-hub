# ---- build stage -----------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime stage ---------------------------------------------------------
FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server/server.mjs ./server/server.mjs
# /data is overlaid by the PVC in-cluster; chown here is only for local `docker run`
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
VOLUME /data
CMD ["node", "server/server.mjs"]
