OPY . .
399ms
build
RUN node - <<'JS'
167ms
Sanitized: package.json
build
RUN if [ -f package-lock.json ]; then       npm ci --workspaces --include-workspace-root;     else       npm install --workspaces --include-workspace-root;     fi
16s
npm error code ETARGET
npm error notarget No matching version found for dxf-writer@^2.0.1.
npm error notarget In most cases you or one of your dependencies are requesting
npm error notarget a package version that doesn't exist.
npm notice
npm notice New major version of npm available! 10.8.2 -> 11.6.0
npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.6.0
npm notice To update run: npm install -g npm@11.6.0
npm notice
npm error A complete log of this run can be found in: /root/.npm/_logs/2025-09-14T18_26_22_821Z-debug-0.log
Dockerfile:98
-------------------
97 |     # (works with npm v7+ which supports workspaces).
98 | >>> RUN if [ -f package-lock.json ]; then \
99 | >>>       npm ci --workspaces --include-workspace-root; \
100 | >>>     else \
101 | >>>       npm install --workspaces --include-workspace-root; \
102 | >>>     fi
103 |
-------------------
ERROR: failed to build: failed to solve: process "/bin/sh -c if [ -f package-lock.json ]; then       npm ci --workspaces --include-workspace-root;     else       npm install --workspaces --include-workspace-root;     fi" did not complete successfully: exit code: 1
