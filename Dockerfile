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
RUN echo "Starting build process..."
RUN echo "Current directory structure:"
RUN find . -name "package.json" -type f
RUN echo "Building server workspace:"
RUN echo "Server tsconfig:"
RUN cat apps/server/tsconfig.json || echo "No tsconfig found"
# Try building just the minimal server first
RUN echo "Testing minimal TypeScript compilation:"
RUN cd apps/server && npx tsc src/minimal-server.ts --outDir dist --target ES2022 --module commonjs --esModuleInterop --allowSyntheticDefaultImports --moduleResolution node || echo "Minimal compilation failed"
RUN ls -la apps/server/dist/ || echo "No dist created"
RUN echo "Now trying full server build:"
RUN echo "Checking source files before build:"
RUN ls -la apps/server/src/
RUN echo "Running TypeScript compilation with verbose output:"
RUN cd apps/server && npx tsc --listFiles --listEmittedFiles || echo "Direct tsc failed"
RUN echo "Running via npm script:"
RUN npm run build --workspace=apps/server --verbose 2>&1 || (echo "❌ Server build failed!" && echo "Checking TypeScript installation:" && npx tsc --version && exit 1)
RUN echo "Building web workspace:"
RUN npm run build --workspace=apps/web || (echo "Web build failed!" && exit 1)
RUN echo "Build completed. Checking dist directories:"
RUN ls -la apps/server/ || echo "apps/server not found"
RUN ls -la apps/server/dist/ || echo "apps/server/dist not found"
RUN ls -la apps/web/dist/ || echo "apps/web/dist not found"
RUN echo "Checking build results:"
RUN ls -la apps/server/dist/ || echo "No dist directory"
RUN test -f apps/server/dist/index.js && echo "✅ index.js found" || echo "❌ index.js NOT found"
RUN test -f apps/server/dist/minimal-server.js && echo "✅ minimal-server.js found" || echo "❌ minimal-server.js NOT found"
RUN echo "All .js files in project:"
RUN find . -name "*.js" -type f | head -10

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
# Try main server first, fallback to minimal server
CMD ["sh", "-c", "if [ -f apps/server/dist/index.js ]; then echo 'Starting main server'; node apps/server/dist/index.js; elif [ -f apps/server/dist/minimal-server.js ]; then echo 'Starting minimal server'; node apps/server/dist/minimal-server.js; else echo 'No server files found'; ls -la apps/server/dist/; exit 1; fi"]
