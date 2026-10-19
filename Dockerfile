# ---- build stage -----------------------------------------------------------
FROM node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime stage ---------------------------------------------------------
FROM node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server/ ./server/
# /data is overlaid by the PVC in-cluster; chown here is only for local `docker run`
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
VOLUME /data
CMD ["node", "server/server.mjs"]
