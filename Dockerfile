# -----------------------------------------------------------------------------
# .dockerignore suggestions:
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

ENV NODE_OPTIONS="--max-old-space-size=2048" \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

# Native build deps (removed later)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates git perl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy just manifests first (for better caching)
COPY package*.json ./

# --- FIX invalid JSON in package.json (remove // and /* */ comments, and trailing commas) ---
# 1) strip block comments  /* ... */    2) strip line comments // ... (not inside strings)
# 3) remove trailing commas before } or ]  4) basic sanity check via node -e JSON.parse
RUN set -eux; \
    if [ -f package.json ]; then \
      perl -0777 -pe 's{/\*.*?\*/}{}gs; s/^\s*//.*$//mg' package.json > package.json.cleaned; \
      perl -0777 -pe 's/,\s*([\}\]])/$1/gs' package.json.cleaned > package.json; \
      rm -f package.json.cleaned; \
      node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"; \
    fi

# Install deps (uses cleaned package.json). Falls back if no lockfile.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy the rest of the source
COPY . .

# Build (assumes `npm run build` emits to ./dist)
RUN npm run build

# Reduce to production deps only (keep dist)
RUN npm prune --omit=dev

# ---- Runtime stage -----------------------------------------------------------
FROM node:18-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# curl for HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only what is needed; avoid npm in runtime (so invalid JSON is no longer a problem)
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public 2>/dev/null || true

# Non-root for security
USER node

# Railway ignores EXPOSE, but good for local runs
EXPOSE 3000

# Healthcheck tries /api/health then /
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || curl -fsS "http://127.0.0.1:${PORT}/" || exit 1

# Ensure your server binds 0.0.0.0 and uses process.env.PORT
CMD ["node", "dist/index.js"]