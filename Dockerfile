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
COPY package*.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# 3. Sanitize all package.json and package-lock.json files recursively (for npm install)
RUN find . -name "package*.json" -exec sh -c 'strip-json-comments "$0" > "$0.tmp" && mv "$0.tmp" "$0"' {} \;

# 4. Install all dependencies for the entire monorepo
RUN npm install --workspaces --include-workspace-root

# 5. Copy the rest of the source code (this overwrites the sanitized manifests)
COPY . .

# 6. Sanitize the package.json files AGAIN (for npm run build)
RUN find . -name "package*.json" -exec sh -c 'strip-json-comments "$0" > "$0.tmp" && mv "$0.tmp" "$0"' {} \;

# 7. Build both the 'server' and 'web' workspaces
RUN npm run build --workspaces

# 8. Prune development-only dependencies
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
COPY --from=builder --chown=nodejs:nodejs /app/apps/web/dist ./apps/server/public
COPY --from=builder --chown=nodejs:nodejs /app/shared ./shared
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/apps/server/package.json ./apps/server/
COPY --from=builder --chown=nodejs:nodejs /app/apps/web/package.json ./apps/web/

# 4. Switch to the non-root user
USER nodejs

# 5. Expose the port the app will listen on.
EXPOSE 8080

# 6. Add a healthcheck for Railway to monitor the application's health
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl --fail http://localhost:8080/api/health || curl --fail http://localhost:8080/ || exit 1

# 7. Define the command to start the server
CMD ["node", "apps/server/dist/index.js"]