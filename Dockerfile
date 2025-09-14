# filename: Dockerfile
# Multi-stage build for production-ready PNG to SVG/DXF converter
FROM node:18-alpine AS base

# Install system dependencies for ONNX runtime and image processing
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

WORKDIR /app

# Copy package files and lockfiles
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
COPY apps/web/package*.json ./apps/web/

# Create shared directory and copy package.json if it exists
RUN mkdir -p ./shared
RUN if [ -f "shared/package.json" ]; then \
        cp shared/package*.json ./shared/; \
    else \
        echo "No shared package.json found, skipping..."; \
    fi

# Install dependencies - use npm install if no lockfile exists
RUN if [ -f "package-lock.json" ]; then \
        npm ci --omit=dev; \
    else \
        npm install --only=production; \
    fi

# Development stage
FROM base AS development
RUN if [ -f "package-lock.json" ]; then \
        npm ci; \
    else \
        npm install; \
    fi
COPY . .
EXPOSE 3000 5173
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
RUN if [ -f "package-lock.json" ]; then \
        npm ci; \
    else \
        npm install; \
    fi
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    libjpeg-turbo \
    freetype

WORKDIR /app

# Copy built application
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/web/dist ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules

# Create models directory
RUN mkdir -p ./models

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/index.js"]