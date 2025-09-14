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

# --- 1) Sanitize package.json (JSONC/JS -> strict JSON) BEFORE installing ---
RUN node - <<'JS'
const fs = require('fs'); const vm = require('vm');
function toStrictJSON(path){
  if (!fs.existsSync(path)) return;
  let src = fs.readFileSync(path,'utf8')
    .replace(/^\uFEFF/,'').replace(/\r\n/g,'\n')
    .replace(/^\s*module\.exports\s*=\s*/,'')
    .replace(/^\s*export\s+default\s+/,'').trim();
  const wrapped = '(' + src + ')';
  let obj;
  try { obj = vm.runInNewContext(wrapped, {}, {timeout:1000}); }
  catch(e){ console.error('package.json eval failed:', e.message); process.exit(1); }
  fs.writeFileSync(path, JSON.stringify(obj,null,2));
}
toStrictJSON('package.json');
JS

# Install deps (now valid JSON). Falls back if no lockfile.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Bring in the rest of the source
COPY . .

# --- 2) Sanitize AGAIN because COPY . . may have overwritten package.json ---
RUN node - <<'JS'
const fs = require('fs'); const vm = require('vm');
function toStrictJSON(path){
  if (!fs.existsSync(path)) return;
  let src = fs.readFileSync(path,'utf8')
    .replace(/^\uFEFF/,'').replace(/\r\n/g,'\n')
    .replace(/^\s*module\.exports\s*=\s*/,'')
    .replace(/^\s*export\s+default\s+/,'').trim();
  const wrapped = '(' + src + ')';
  let obj;
  try { obj = vm.runInNewContext(wrapped, {}, {timeout:1000}); }
  catch(e){ console.error('package.json eval failed (post-copy):', e.message); process.exit(1); }
  fs.writeFileSync(path, JSON.stringify(obj,null,2));
}
toStrictJSON('package.json');
JS

# Build (assumes `npm run build` -> ./dist)
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

# Copy only what is needed; no npm runs here
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public 2>/dev/null || true

# Non-root for security
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || curl -fsS "http://127.0.0.1:${PORT}/" || exit 1

CMD ["node", "dist/index.js"]