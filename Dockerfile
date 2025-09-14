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

# --- Convert JSONC/JS-style package.json -> strict JSON via JS evaluation ---
# Wrap contents in parentheses and evaluate as an object literal.
# This tolerates // comments, /* */ comments, single quotes, trailing commas, etc.
RUN node - <<'JS'
const fs = require('fs');
const vm = require('vm');

function toStrictJSON(path) {
  if (!fs.existsSync(path)) return;
  let src = fs.readFileSync(path, 'utf8');

  // Remove BOM, normalize newlines
  src = src.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

  // If file accidentally has `module.exports = {...}` or `export default {...}`,
  // coerce it to a bare object literal.
  src = src.replace(/^\s*module\.exports\s*=\s*/,'')
           .replace(/^\s*export\s+default\s+/,'')
           .trim();

  // Ensure we evaluate a pure expression (object/array) by wrapping in ( )
  const wrapped = '(' + src + ')';

  let obj;
  try {
    obj = vm.runInNewContext(wrapped, {}, { timeout: 1000 });
  } catch (e) {
    console.error('Failed to interpret package.json as JS object literal:', e.message);
    process.exit(1);
  }

  fs.writeFileSync(path, JSON.stringify(obj, null, 2));
}

toStrictJSON('package.json');
JS

# Install deps (now using strict JSON). Falls back if no lockfile.
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

# Copy only what we need; no npm runs here
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