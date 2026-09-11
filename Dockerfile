# ---- build stage -----------------------------------------------------------
FROM node:24-alpine@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime stage ---------------------------------------------------------
FROM node:24-alpine@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81
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
