# hadolint ignore=DL3006
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM scratch
COPY --from=builder /app/dist /headlamp/plugins/mirops/
