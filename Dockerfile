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
    python3 make g++ ca-certificates git \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests first (cache-friendly)
COPY package*.json ./

# --- Sanitize package.json: remove comments + trailing commas, then validate ---
# Uses Node itself (no npm packages) to convert JSONC-like to strict JSON.
RUN node - <<'JS'
const fs = require('fs');
function clean(jsonPath){
  let s = fs.readFileSync(jsonPath, 'utf8');
  // Remove BOM
  s = s.replace(/^\uFEFF/, '');
  // Remove block comments  /* ... */
  s = s.replace(/\/\*[^]*?\*\//g, '');
  // Remove line comments // ...  (not perfect, but good enough for JSONC)
  s = s.replace(/^\s*\/\/.*$/mg, '');
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');
  // Trim
  s = s.trim();
  // Validate
  JSON.parse(s);
  fs.writeFileSync(jsonPath, s);
}
if (fs.existsSync('package.json')) clean('package.json');
JS

# Install deps (uses cleaned package.json). Falls back if no lockfile.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy the rest and build (assumes `npm run build` -> ./dist)
COPY . .
RUN npm run build

# Reduce to production deps only, keeping dist
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

# Copy only what we need; no npm runs here (so JSON comments won’t matter)
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public 2>/dev/null || true

# Non-root for security
USER node

# EXPOSE is numeric (Railway injects $PORT at runtime)
EXPOSE 3000

# Healthcheck tries /api/health then /
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || curl -fsS "http://127.0.0.1:${PORT}/" || exit 1

# Ensure your server binds 0.0.0.0 and uses process.env.PORT
CMD ["node", "dist/index.js"]