# -----------------------------------------------------------------------------
# .dockerignore suggestions (put these lines in a real .dockerignore file):
# node_modules
# dist
# .next
# .turbo
# .cache
# npm-debug.log*
# .env
# .env.*
# .DS_Store
# coverage
# build
# -----------------------------------------------------------------------------

# ---- Build stage -------------------------------------------------------------
FROM node:18-slim AS build
LABEL org.opencontainers.image.source="Railway-ready Node/TS build"

# Optional: speed/caching tweaks
ENV NODE_OPTIONS="--max-old-space-size=2048" \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

# Native deps (only in build stage for packages like sharp/canvas)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps with caching
COPY package*.json ./
# If you use workspaces/monorepo: COPY ./pnpm-lock.yaml ./yarn.lock as needed
# Use npm ci when lockfile exists, else fallback
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source
COPY . .

# Build TypeScript/Next/etc. (assumes "build" script compiles to ./dist)
# If your build outputs elsewhere, adjust the COPY in the runtime stage below.
RUN npm run build

# ---- Runtime stage -----------------------------------------------------------
FROM node:18-slim AS runtime
LABEL org.opencontainers.image.title="Railway-ready Node runtime"

# Railway injects $PORT at runtime. We default to 3000 but MUST listen on 0.0.0.0:$PORT.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# curl for HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install ONLY production deps
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Bring in compiled app and any static assets produced by build
# Assumes your build outputs server code to ./dist and optional public assets to ./public
COPY --from=build /app/dist ./dist
# Don't fail if public doesn't exist
COPY --from=build /app/public ./public 2>/dev/null || true

# Non-root for security (built-in "node" user exists in node:*-slim)
USER node

# EXPOSE cannot read env vars at build time; use a numeric fallback.
# Railway ignores EXPOSE but it's nice for local runs.
EXPOSE 3000

# Healthcheck tries /api/health then /
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || curl -fsS "http://127.0.0.1:${PORT}/" || exit 1

# Start your server. Ensure your app reads process.env.PORT and binds to 0.0.0.0
# e.g., server.listen(process.env.PORT, '0.0.0.0', ...)
CMD ["node", "dist/index.js"]