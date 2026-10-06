# ==========================================
# ELYS — Advanced Task Scheduler
# Multi-stage Hardened Dockerfile
# Developer: Adrián Palma
# ==========================================

# STAGE 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install native compilation toolchain for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy root and client package definitions
COPY package*.json ./
COPY client/package*.json ./client/

# Install root dependencies
RUN npm ci

# Install client dependencies
WORKDIR /app/client
RUN npm ci

# Copy full source code
WORKDIR /app
COPY version.json ./
COPY server ./server
COPY client ./client

# Build client and server
RUN npm run build

# Prune dev dependencies, keeping only production modules
RUN npm prune --omit=dev

# STAGE 2: Production Runner
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4800
ENV DATA_DIR=/data

# Install necessary runtime tools (bash, curl, tzdata, ca-certificates)
RUN apk add --no-cache bash curl tzdata ca-certificates

# Copy package metadata
COPY package.json version.json ./

# Copy compiled production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled application artifacts from builder
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Setup persistent volume directory with proper permissions for non-root user
RUN mkdir -p /data && chown -R node:node /app /data

# Persistent volume for SQLite database
VOLUME ["/data"]

# Switch to non-root node user for container execution
USER node

EXPOSE 4800

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4800/api/system/health || exit 1

CMD ["node", "server/dist/index.js"]
