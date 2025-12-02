# Dockerfile for Strava Sync Cloud Run Service
# Multi-stage build for optimized production image

# Stage 1: Build stage
FROM node:20-slim AS builder

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY config/ ./config/

# Stage 2: Production stage
FROM node:20-slim

# Install security updates
RUN apt-get update && apt-get upgrade -y && apt-get clean && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy application code from builder
COPY --from=builder /usr/src/app/src ./src

# The node image already has a 'node' user, use that for security
RUN chown -R node:node /usr/src/app

# Switch to non-root user
USER node

# Cloud Run provides PORT environment variable
ENV PORT=8080
ENV NODE_ENV=production

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "src/server.js"]
