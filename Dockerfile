# hadolint ignore=DL3006
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# busybox (not scratch) so an initContainer can `cp` the plugin into
# Headlamp's shared plugins volume when deployed in-cluster.
FROM busybox:1.37.0
COPY --from=builder /app/dist /plugins/mirops/
