# Multi-stage build for PNG2Vector monorepo
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
RUN npm ci --workspaces

# Copy source code
COPY . .

# Build both applications
RUN npm run build

# Production stage
FROM node:20-slim AS runtime

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy package files and install production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/server/package.json ./apps/server/
RUN npm ci --only=production --workspaces

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/apps/server/dist ./
COPY --from=builder --chown=nodejs:nodejs /app/apps/server/public ./public
COPY --from=builder --chown=nodejs:nodejs /app/models ./models

USER nodejs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl --fail http://localhost:8080/api/health || exit 1

CMD ["node", "apps/server/src/index.js"]
