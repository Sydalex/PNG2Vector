#!/bin/bash

# Test script to debug TypeScript compilation issues
echo "=== TypeScript Build Test ==="

# Navigate to server directory
cd apps/server

echo "1. Checking TypeScript configuration..."
cat tsconfig.json

echo -e "\n2. Checking source files..."
find src -name "*.ts" -type f

echo -e "\n3. Cleaning any existing dist..."
rm -rf dist

echo -e "\n4. Testing TypeScript compilation..."
echo "Running: npx tsc --listFiles --listEmittedFiles"

# Run in Docker to simulate build environment
docker run --rm -v "$(pwd)/../..:/app" -w /app/apps/server node:20-slim bash -c "
  npm install -g typescript
  tsc --listFiles --listEmittedFiles
  echo 'Files in dist after compilation:'
  find dist -type f 2>/dev/null || echo 'No dist directory created'
"

echo -e "\n=== Test Complete ==="