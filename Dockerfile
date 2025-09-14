# Suggested .dockerignore
#
# # Dependencies
# node_modules
#
# # Build artifacts
# dist
# .next
#
# # Logs & temp files
# *.log
# .DS_Store
#
# # Local Environment
# .env
# .env.*
# !.env.example
#
# # Git & OS
# .git
# .vscode

# ==============================================================================
# Build Stage ------------------------------------------------------------------
# This stage installs all dependencies (dev included), sanitizes JSON files,
# builds the project, and then prunes to production-only dependencies.
# ==============================================================================
FROM node:20-slim AS builder

WORKDIR /app

# 1. Install sanitization tool globally
RUN npm install -g strip-json-comments-cli

# 2. Copy only package manifests to leverage Docker cache
# CHANGED: Use a wildcard to handle a potentially missing package-lock.json
COPY package*.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# 3. Sanitize all package.json and package-lock.json files recursively
RUN find . -name "package*.json" -exec sh -c 'strip-json-comments "$0" > "$0.tmp" && mv "$0.tmp" "$0"' {} \;

# 4. Install all dependencies for the entire monorepo
RUN npm ci --workspaces --include-workspace-root

# 5. Copy the rest of the source code
COPY . .

# 6. Build both the 'server' and 'web' workspaces
RUN npm run build --workspaces

# 7. Prune development-only dependencies
RUN npm prune --production --workspaces --include-workspace-root


# ==============================================================================
# Runtime Stage ----------------------------------------------------------------
# This final stage is a slim image containing only the built application,
# production dependencies, and necessary runtime tools.
# ==============================================================================
FROM node:20-slim AS runtime

WORKDIR /app

# 1. Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# 2. Install curl for the HEALTHCHECK
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# 3. Copy necessary artifacts from the 'builder' stage
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/apps/server/dist ./apps/server/dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/web/dist ./apps/web/dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/apps/server/package.json ./apps/server/
COPY --from=builder --chown=nodejs:nodejs /app/apps/web/package.json ./apps/web/

# 4. Switch to the non-root user
USER nodejs

# 5. Expose the port the app will listen on.
EXPOSE 3000

# 6. Add a healthcheck for Railway to monitor the application's health
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl --fail http://localhost:3000/api/health || curl --fail http://localhost:3000/ || exit 1

# 7. Define the command to start the server
CMD ["node", "apps/server/dist/index.js"]