# filename: Dockerfile
# Railway-optimized build without problematic ONNX dependencies
FROM node:18-slim AS base

# Enable Railway build cache
LABEL railway.build.cache="true"

# Build optimization environment variables
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV NPM_CONFIG_PROGRESS=false
ENV NPM_CONFIG_LOGLEVEL=warn
ENV NPM_CONFIG_AUDIT=false
ENV NPM_CONFIG_FUND=false

# Install system dependencies for image processing (without ONNX)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
COPY apps/web/package*.json ./apps/web/

# Clean package.json files by removing comments
RUN sed -i '/^[[:space:]]*\/\//d' package.json 2>/dev/null || true
RUN sed -i '/^[[:space:]]*\/\//d' apps/server/package.json 2>/dev/null || true
RUN sed -i '/^[[:space:]]*\/\//d' apps/web/package.json 2>/dev/null || true

# Fix known package version issues AND remove problematic ONNX dependency
RUN sed -i 's/"dxf-writer": "\^2\.0\.1"/"dxf-writer": "^1.0.0"/g' package.json 2>/dev/null || true
RUN sed -i 's/"dxf-writer": "\^2\.0\.1"/"dxf-writer": "^1.0.0"/g' apps/server/package.json 2>/dev/null || true

# CRITICAL: Remove or replace onnxruntime-node dependency
RUN sed -i '/"onnxruntime-node"/d' package.json 2>/dev/null || true
RUN sed -i '/"onnxruntime-node"/d' apps/server/package.json 2>/dev/null || true

# Handle shared directory
RUN mkdir -p ./shared
RUN if [ -f "shared/package.json" ]; then \
        cp shared/package*.json ./shared/; \
        sed -i '/^[[:space:]]*\/\//d' ./shared/package.json 2>/dev/null || true; \
        sed -i 's/"dxf-writer": "\^2\.0\.1"/"dxf-writer": "^1.0.0"/g' ./shared/package.json 2>/dev/null || true; \
        sed -i '/"onnxruntime-node"/d' ./shared/package.json 2>/dev/null || true; \
    else \
        echo "No shared package.json found, skipping..."; \
    fi

# Remove package-lock.json to force fresh install
RUN rm -f package-lock.json apps/server/package-lock.json apps/web/package-lock.json

# Install dependencies without ONNX issues
RUN npm install --omit=dev --no-audit --no-fund --legacy-peer-deps

# Development stage
FROM base AS development
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY . .
EXPOSE 3000 5173
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY . .
RUN npm run build

# Production stage
FROM node:18-slim AS production

# Install only runtime dependencies
RUN apt-get update && apt-get install -y \
    libcairo2 \
    libjpeg62-turbo \
    libpango-1.0-0 \
    libgif7 \
    librsvg2-2 \
    libpixman-1-0 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

# Railway-specific environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

# Copy built application
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/web/dist ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules

# Create models directory with proper permissions
RUN mkdir -p ./models && chmod 755 ./models

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -r -u 1001 -g nodejs nodejs

# Set ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port using environment variable
EXPOSE $PORT

# Railway-compatible health check (check both / and /api/health)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:$PORT/api/health || curl -f http://localhost:$PORT/ || exit 1

# Add graceful shutdown handling
STOPSIGNAL SIGTERM

CMD ["node", "dist/index.js"]