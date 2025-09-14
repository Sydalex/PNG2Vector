```dockerfile
# .dockerignore suggestion:
# node_modules
# dist
# .DS_Store
# **/*.log
# npm-debug.log*
# .env
# .env.*
# .vscode
# .idea

# --- Build Stage ---
FROM node:20-slim AS builder

# Set working directory for the monorepo
WORKDIR /app

# Install git and curl for health check
RUN apt-get update && apt-get install -y git curl --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Helper script to sanitize JSON files (removes comments and trailing commas)
# This is required because the provided package.json files contain comments,
# which are not valid JSON and will cause npm install to fail.
COPY --from=node:20-slim /usr/bin/node /usr/bin/
COPY --from=node:20-slim /usr/lib/node_modules/npm /usr/lib/node_modules/npm/
RUN <<'JS'
  const fs = require('fs');
  const path = require('path');
  const { readdirSync, statSync } = fs;

  function findJsonFiles(dir) {
    let files = [];
    const items = readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files = files.concat(findJsonFiles(fullPath));
      } else if (stat.isFile() && item.endsWith('.json')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const jsonFiles = findJsonFiles('/app');
  for (const filePath of jsonFiles) {
    let content = fs.readFileSync(filePath, 'utf-8');
    // Remove comments
    content = content.replace(/\/\/.*$/gm, '');
    // Remove trailing commas
    content = content.replace(/,(\s*[}\]])/g, '$1');
    fs.writeFileSync(filePath, content);
  }
JS

# Copy and install dependencies
COPY package.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY tsconfig.base.json ./
COPY apps/server/tsconfig.json apps/server/
COPY apps/web/tsconfig.json apps/web/
RUN npm install --workspaces --include-workspace-root

# Copy the rest of the source code
COPY . .

# Run the build script, which builds both server and web apps
RUN npm run build --workspaces

# Prune dev dependencies for production
RUN npm prune --omit=dev --workspaces --include-workspace-root

# --- Production Stage ---
FROM node:20-slim

# Set working directory and install curl for health checks
WORKDIR /app
RUN apt-get update && apt-get install -y curl --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Create a non-root user and switch to it for security
RUN groupadd --gid 1000 nodejs \
  && useradd --uid 1000 --gid nodejs --shell /bin/bash nodejs
USER nodejs

# Copy pruned dependencies, built code, and assets from the build stage
COPY --from=builder /app/package.json ./
COPY --from=builder /app/apps/server/package.json apps/server/
COPY --from=builder /app/apps/web/package.json apps/web/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/node_modules apps/server/node_modules
COPY --from=builder /app/apps/web/node_modules apps/web/node_modules
COPY --from=builder /app/apps/server/dist apps/server/dist
COPY --from=builder /app/apps/web/dist apps/web/dist
COPY --from=builder /app/models models

# Expose the port the app runs on
EXPOSE 3000

# Railway sets a $PORT environment variable, but the app uses process.env.PORT, which is compatible.

# Define a health check for Railway
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl --fail http://localhost:$PORT/api/health || exit 1

# Command to start the application
CMD ["node", "apps/server/dist/index.js"]
```