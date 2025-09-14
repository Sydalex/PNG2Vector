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

# Native deps for building native modules (sharp/canvas/etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates git \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the whole repo (we need all workspaces' manifests to sanitize)
COPY . .

# --- Recursively sanitize ALL package.json / package-lock.json files ----------
# Accepts JSON with // and /* */ comments, trailing commas, single quotes,
# or even JS-y object literals and outputs strict JSON.
RUN node - <<'JS'
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function read(file){ return fs.readFileSync(file,'utf8'); }
function write(file, s){ fs.writeFileSync(file, s); }

function stripCommentsAndTrailingCommas(s){
  s = s.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
  s = s.replace(/\/\*[^]*?\*\//g,'');      // block comments
  s = s.replace(/^\s*\/\/.*$/mg,'');       // line comments
  s = s.replace(/,\s*([}\]])/g,'$1');      // trailing commas
  return s.trim();
}

function toStrictJSON(content, allowJS = true){
  let s = content;
  // First try plain JSON (fast path)
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch {}
  // Try JSONC (comments + trailing commas)
  try { return JSON.stringify(JSON.parse(stripCommentsAndTrailingCommas(s)), null, 2); } catch {}
  if (!allowJS) throw new Error('Not JSON/JSONC');
  // Try JS object literal evaluation
  s = s.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
  s = s.replace(/^\s*module\.exports\s*=\s*/,'')
       .replace(/^\s*export\s+default\s+/,'')
       .trim();
  const wrapped = '(' + s + ')';
  let obj;
  try { obj = vm.runInNewContext(wrapped, {}, {timeout: 1000}); }
  catch(e){ throw new Error('JS eval failed: ' + e.message); }
  return JSON.stringify(obj, null, 2);
}

function processFile(file){
  try {
    const orig = read(file);
    const fixed = toStrictJSON(orig, true);
    if (fixed !== orig) write(file, fixed);
    console.log('Sanitized:', file);
  } catch (e) {
    console.error('Sanitize failed for', file, '-', e.message);
    process.exit(1);
  }
}

function walk(dir){
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.isFile()) {
      if (entry.name === 'package.json' || entry.name === 'package-lock.json') processFile(p);
    }
  }
}
walk('.');
JS

# Install deps for all workspaces using the root lockfile if present
# (works with npm v7+ which supports workspaces).
RUN if [ -f package-lock.json ]; then \
      npm ci --workspaces --include-workspace-root; \
    else \
      npm install --workspaces --include-workspace-root; \
    fi

# Build both apps (your root build script already calls each workspace build)
RUN npm run build

# Prune to production across workspaces
RUN npm prune --omit=dev --workspaces --include-workspace-root

# ---- Runtime stage -----------------------------------------------------------
FROM node:18-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

# curl for HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only what's needed to run
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps ./apps
COPY --from=build /app/public ./public 2>/dev/null || true

# Non-root for security
USER node

# For local runs; Railway injects $PORT at runtime
EXPOSE 3000

# Healthcheck tries /api/health then /
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || curl -fsS "http://127.0.0.1:${PORT}/" || exit 1

# Start the server (adjust if your entry changes)
CMD ["node", "apps/server/dist/index.js"]