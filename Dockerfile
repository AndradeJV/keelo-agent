# =============================================================================
# Keelo API - Production Dockerfile
# Multi-stage build optimized for Kubernetes deployment
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build TypeScript
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first (layer caching)
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code and build config
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript → dist/
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Production image
# ---------------------------------------------------------------------------
FROM node:22-alpine AS production

LABEL maintainer="Keelo Team"
LABEL description="Keelo - Autonomous QA Agent API"

WORKDIR /app

# Install dumb-init for proper signal handling in containers (PID 1 problem)
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S keelo && \
    adduser -S keelo -u 1001 -G keelo

# Copy package files
COPY package*.json ./

# Update npm to latest (fixes CVEs in bundled glob/tar) and install production deps
RUN npm install -g npm@latest && \
    npm ci --omit=dev && \
    npm cache clean --force

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# Copy runtime assets (read from disk at runtime)
COPY prompts ./prompts
COPY knowledges ./knowledges
# COPY .keelo.json ./.keelo.json

# Copy database schema & migrations (for init/migration scripts)
COPY database ./database

# Create data directory for local file caching
RUN mkdir -p .keelo-data && chown -R keelo:keelo /app

# Switch to non-root user
USER keelo

# Expose API port
EXPOSE 3000

# Healthcheck for Kubernetes liveness/readiness probes fallback
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly (SIGTERM from K8s)
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/main.js"]
