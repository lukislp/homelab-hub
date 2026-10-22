# ---- build stage -----------------------------------------------------------
FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime stage ---------------------------------------------------------
FROM node:24-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53
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
