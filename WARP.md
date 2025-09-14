# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Environment Setup
```bash
# Install all dependencies for the monorepo (including workspaces)
npm install

# Clean build artifacts and dependencies
npm run clean
```

### Development
```bash
# Start both frontend and backend in development mode
npm run dev

# Start backend only (Express server on port 8080)
npm run dev:server

# Start frontend only (Vite dev server on port 5173)
npm run dev:web
```

### Building
```bash
# Build both server and web applications
npm run build

# Start production server (requires build first)
npm start
```

### Testing
```bash
# Run all tests
npm test

# Run specific test files
npm test -- geometry.test.ts
npm test -- contour.test.ts
npm test -- dxf.test.ts

# Run tests with coverage
npm run test:coverage
```

### Linting
```bash
# Lint entire codebase
npm run lint

# Lint specific workspace
npm run lint --workspace=apps/server
npm run lint --workspace=apps/web
```

### Docker
```bash
# Build Docker image
docker build -t png2vector .

# Run in development
docker run -p 8080:8080 png2vector

# Run in production with environment variables
docker run -d -p 8080:8080 -e NODE_ENV=production --name png2vector png2vector:latest

# Health check
curl http://localhost:8080/api/health
```

## Architecture Overview

### Monorepo Structure
This is a TypeScript monorepo with npm workspaces:

- **`apps/server/`** - Express.js backend API (Node.js + TypeScript)
- **`apps/web/`** - React frontend (Vite + TypeScript)
- **`shared/`** - Shared TypeScript types and interfaces
- **`models/`** - ONNX machine learning models directory
- **`tests/`** - Comprehensive test suites
- **`fixtures/`** - Test images and sample data

### AI-Assisted Processing Pipeline
The core application implements a **Tier-2 AI-assisted pipeline** for PNG to vector conversion:

1. **Image Upload** - PNG files via multipart/form-data (50MB limit)
2. **Optional AI Preprocessing** - ONNX-based edge detection using HED model when `useAI=true`
3. **Deterministic Vectorization** - Binary thresholding, morphological operations, contour tracing
4. **Geometry Validation** - Self-intersection repair, winding order normalization, grid snapping
5. **Export Generation** - SVG with VectorWorks classes and DXF with LWPOLYLINE entities

### Key Processing Modules
Located in `apps/server/src/trace/`:

- **`contour.ts`** - Moore neighborhood contour tracing and Douglas-Peucker simplification
- **`geometry.ts`** - Polygon validation, cleanup, and winding order enforcement
- **`svg.ts`** - SVG generation with VectorWorks classes (`VW_CLASS_Detail`, `VW_CLASS_Fill`)
- **`dxf.ts`** - DXF generation with closed LWPOLYLINE entities and optional HATCH
- **`hed.ts`** - ONNX-based HED edge detection model integration
- **`raster.ts`** - Image processing, binary thresholding, morphological operations

### API Contract
- **POST `/api/trace`** - Main conversion endpoint with fidelity, whiteFill, threshold, useAI parameters
- **GET `/api/health`** - Health check for monitoring
- **Static file serving** - Frontend served from `/`

### Development Workflow
1. **Shared Types** - Update `shared/types.ts` for API contract changes
2. **Backend Logic** - Implement in `apps/server/src/` with proper error handling
3. **Frontend Updates** - React components in `apps/web/src/` with TypeScript
4. **Testing** - Add tests in `tests/` directory covering geometry, contour, and DXF modules
5. **Documentation** - Update README.md for user-facing changes

## Project-Specific Guidelines

### CAD Compatibility Requirements
This project generates output specifically for CAD applications (VectorWorks, ArchiCAD):

- **SVG Output**: Must use `fill-rule="evenodd"` and VectorWorks layer classes
- **DXF Output**: Only closed LWPOLYLINE entities, never SPLINE or LINE
- **Geometry**: Counter-clockwise exteriors, clockwise holes, consistent winding order
- **Precision**: 6 decimal places for coordinates, grid snapping to 0.001 units

### AI Model Integration
- Models are **optional** - system falls back to deterministic processing
- Place ONNX models in `models/` directory (see `models/README.md`)
- HED model (`hed.onnx`) provides edge detection for crisp boundaries
- Use `DEBUG_AI=true` environment variable for AI debugging
- Server-side only processing allows GPL models if needed

### Fidelity Parameter Mapping
The fidelity (0-100) parameter controls processing quality:
```typescript
// Simplification epsilon: higher fidelity = lower epsilon (more detail)
epsilon = baseEpsilon * (1 - fidelity/100 * 0.8)

// Speckle removal: higher fidelity = smaller minimum area
areaMin = baseAreaMin * (1 - fidelity/100 * 0.9)
```

### Testing Requirements
- **Geometry validation tests**: Winding order, self-intersections, cleanup
- **Contour extraction tests**: Moore tracing, hole detection, simplification
- **DXF generation tests**: LWPOLYLINE structure, HATCH parity, layer validation
- **API endpoint tests**: File upload, parameter validation, error handling

### TypeScript Configuration
- Uses strict TypeScript mode with shared `tsconfig.base.json`
- Path aliases: `@shared/*` resolves to `./shared/*`
- Module resolution: CommonJS for server, ES modules for web
- Target: ES2022 for modern JavaScript features

### Docker Deployment
- Multi-stage build: builder stage + slim runtime stage
- Strips JSON comments from package.json files for compatibility
- Non-root user (nodejs:nodejs) for security
- Health check on `/api/health` endpoint
- Port 8080 exposed (configurable via PORT environment variable)

### Environment Variables
- `PORT`: Server port (default: 8080)
- `NODE_ENV`: Environment mode (development/production)
- `DEBUG_AI`: Enable detailed AI model logging

### Error Handling Patterns
- Use structured `ErrorResponse` type with `error`, `details`, and `code` fields
- Validate parameters with specific error codes (`INVALID_FIDELITY`, `MISSING_FILE`, etc.)
- Comprehensive error logging with request context
- Graceful fallbacks for AI model failures

### Performance Considerations
- 50MB file size limit for uploads
- AI processing: 1-3 seconds for 1024x1024 images
- Deterministic pipeline: <500ms for most images
- Memory usage: ~100MB peak for large images
- CPU-only ONNX inference (no GPU acceleration)