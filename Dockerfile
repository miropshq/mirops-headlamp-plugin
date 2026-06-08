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
# Headlamp reads package.json next to main.js to determine the plugin name,
# version and compatibility (devDependencies['@kinvolk/headlamp-plugin']).
# Without it the plugin shows up as 0.0.0 / Incompatible and won't load.
COPY --from=builder /app/dist/main.js /plugins/mirops/main.js
COPY --from=builder /app/package.json /plugins/mirops/package.json
