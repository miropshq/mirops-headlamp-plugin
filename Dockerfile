# hadolint ignore=DL3006
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM scratch
COPY --from=builder /app/dist /headlamp/plugins/mirops/
