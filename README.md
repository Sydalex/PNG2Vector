# filename: README.md

# PNG2Vector - AI-Assisted PNG to SVG/DXF Converter

A production-ready monorepo that converts PNG images to SVG and DXF formats using an AI-assisted Tier-2 pipeline. Designed for CAD applications like VectorWorks and ArchiCAD with deterministic vectorization and optional AI preprocessing.

## 🚀 Features

- **AI-Assisted Preprocessing**: Optional ONNX models for edge detection and segmentation
- **Deterministic Vectorization**: Fully reproducible results with configurable fidelity
- **CAD-Compatible Output**: 
  - SVG with VectorWorks classes (`VW_CLASS_Detail`, `VW_CLASS_Fill`)
  - DXF with closed LWPOLYLINE entities and proper HATCH support
- **Live Preview**: Real-time SVG preview with adjustable parameters
- **Production Ready**: Docker deployment, health checks, error handling
- **Accessibility**: Full keyboard navigation and screen reader support

## 🏗️ Architecture

### Monorepo Structure
```
png2vector/
├── apps/
│   ├── server/          # Node.js + TypeScript + Express API
│   └── web/             # React + Vite frontend
├── shared/              # Shared TypeScript types
├── models/              # ONNX models directory
├── fixtures/            # Test images
└── tests/               # Comprehensive test suite
```

### AI-Assisted Tier-2 Pipeline

1. **Optional AI Preprocessing** (if `useAI=true`):
   - HED edge detection for crisp 1-pixel boundaries
   - Fallback to deterministic pipeline if models unavailable

2. **Deterministic Vectorization**:
   - Binary thresholding with configurable threshold
   - Morphological operations (closing) for cleanup
   - Speckle removal based on connected component area
   - Moore neighborhood contour tracing
   - Douglas-Peucker simplification mapped from fidelity (0-100)

3. **Geometry Validation**:
   - Self-intersection repair using Martinez polygon clipping
   - Consistent winding order (CCW exterior, CW holes)
   - Duplicate point removal with grid snapping
   - Topology validation for CAD compatibility

4. **Export Generation**:
   - **SVG**: Even-odd fill rule, VectorWorks classes
   - **DXF**: Closed LWPOLYLINE only, optional HATCH with even-odd parity

## 📋 API Contract

### POST /api/trace
**Content-Type**: `multipart/form-data`

**Parameters**:
- `image` (file): PNG image file
- `fidelity` (0-100): Detail level (higher = more detail)
- `whiteFill` (boolean): Include white fill layer
- `threshold` (0-255, optional): Binary threshold
- `despeckleAreaMin` (number, optional): Minimum speckle area (px²)
- `useAI` (boolean, optional): Enable AI preprocessing

**Response**:
```json
{
  "svg": "<?xml version=\"1.0\"...",
  "dxf": "base64-encoded-dxf-content",
  "metrics": {
    "nodeCount": 1234,
    "polygonCount": 56,
    "simplification": 0.02,
    "timings": {
      "preprocessing": 150,
      "aiProcessing": 800,
      "vectorization": 300,
      "export": 50,
      "total": 1300
    }
  }
}
```

### GET /api/health
```json
{
  "ok": true,
  "timestamp": "2024-03-15T10:30:00.000Z"
}
```

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start development servers (frontend + backend)
npm run dev

# Frontend: http://localhost:5173
# Backend: http://localhost:8080
# API: http://localhost:8080/api/health
```

### Docker Deployment

```bash
# Build and run
docker build -t png2vector .
docker run -p 8080:8080 png2vector

# Access application
open http://localhost:8080
```

### Production Deployment

```bash
# Build production image
docker build -t png2vector:latest .

# Run with environment variables
docker run -d \
  -p 8080:8080 \
  -e NODE_ENV=production \
  --name png2vector \
  png2vector:latest
```

## 🧠 AI Models Setup

### Required Models

Place ONNX models in the `models/` directory:

- **`models/hed.onnx`**: HED edge detection model (~56MB)
- Optional: `models/mobilesam.onnx`, `models/u2net.onnx`

### Model Sources

1. **ONNX Model Zoo**: https://github.com/onnx/models
2. **Convert from PyTorch**:
   ```python
   import torch
   model = torch.hub.load('pytorch/vision', 'hed', pretrained=True)
   torch.onnx.export(model, dummy_input, "models/hed.onnx")
   ```

### Fallback Behavior

- System works without AI models (deterministic pipeline only)
- Warning logged if models unavailable
- All functionality remains accessible

## 🔧 Configuration

### Fidelity Mapping

The fidelity parameter (0-100) maps to processing parameters:

```typescript
// Simplification epsilon: higher fidelity = lower epsilon (more detail)
epsilon = baseEpsilon * (1 - fidelity/100 * 0.8)

// Speckle removal: higher fidelity = smaller minimum area
areaMin = baseAreaMin * (1 - fidelity/100 * 0.9)
```

### Environment Variables

- `PORT`: Server port (default: 8080)
- `NODE_ENV`: Environment mode
- `DEBUG_AI`: Enable AI debugging logs

## ✅ Verification Checklist

### SVG Output Validation
- [ ] Live preview updates with fidelity changes
- [ ] Uses `VW_CLASS_Detail` (stroke: black) for contours
- [ ] Uses `VW_CLASS_Fill` (fill: white) when enabled
- [ ] Implements `fill-rule="evenodd"` for proper hole handling
- [ ] No duplicate paths or random crossings

### DXF Output Validation
- [ ] Contains only closed LWPOLYLINE entities (no SPLINE/LINE)
- [ ] All polylines have closed flag (`70 = 1`)
- [ ] Uses exact layer names: `VW_CLASS_Detail`, `VW_CLASS_Fill`
- [ ] HATCH entities use even-odd parity when fill enabled
- [ ] Proper boundary path flags (exterior: 2, holes: 16)
- [ ] No tiny squiggles or degenerate geometry

### Geometry Validation
- [ ] Consistent winding order (CCW exterior, CW holes)
- [ ] No self-intersections
- [ ] Closed rings only
- [ ] Grid-snapped coordinates (0.001 unit precision)
- [ ] Minimum area thresholds enforced

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- geometry.test.ts
npm test -- contour.test.ts
npm test -- dxf.test.ts

# Test with coverage
npm run test:coverage
```

### Test Coverage

- **Geometry validation**: Winding order, self-intersections, cleanup
- **Contour extraction**: Moore tracing, hole detection, simplification
- **DXF generation**: LWPOLYLINE structure, HATCH parity, layer validation
- **API endpoints**: File upload, parameter validation, error handling

## 📦 Dependencies

### Backend (Non-GPL)
- **express**: Web framework
- **multer**: File upload handling
- **pngjs**: PNG decoding
- **onnxruntime-node**: AI model inference
- **simplify-js**: Douglas-Peucker simplification
- **martinez-polygon-clipping**: Self-intersection repair

### Frontend
- **react**: UI framework
- **vite**: Build tool and dev server
- **typescript**: Type safety

### Licensing
- All dependencies use permissive licenses (MIT, Apache 2.0, BSD)
- ONNX models may have different licenses (check model sources)
- Server-side AI processing allows GPL models if needed

## 🚨 Known Limitations

### Current Assumptions
- **Input Format**: PNG images only (RGBA support)
- **Color Mode**: Binary processing (foreground/background)
- **Coordinate System**: Pixel coordinates (no DPI scaling)
- **Memory Limits**: 50MB file size limit
- **AI Models**: CPU inference only (no GPU acceleration)

### CAD Compatibility
- **Tested with**: VectorWorks 2024, ArchiCAD 26
- **DXF Version**: AutoCAD 2000 format (AC1015)
- **Coordinate Precision**: 6 decimal places
- **Layer Structure**: Fixed VectorWorks naming convention

### Performance Considerations
- **AI Processing**: 1-3 seconds for 1024x1024 images
- **Deterministic Pipeline**: <500ms for most images
- **Memory Usage**: ~100MB peak for large images
- **Concurrent Requests**: Limited by available memory

## 🔄 Development Workflow

### Adding Features
1. Update shared types in `shared/types.ts`
2. Implement backend logic in `apps/server/src/`
3. Update frontend in `apps/web/src/`
4. Add tests in `tests/`
5. Update documentation

### Code Quality
- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for consistency
- **Prettier**: Code formatting
- **Jest**: Unit and integration tests

## 📈 Deployment on Lovable.dev

### Build Command
```bash
docker build -t png2vector .
```

### Run Command
```bash
docker run -p 8080:8080 png2vector
```

### Environment Setup
- **Port**: Application runs on port 8080
- **Health Check**: `/api/health` endpoint
- **Static Files**: Frontend served from `/`
- **API Routes**: All API endpoints under `/api/`

### Production Considerations
- **Memory**: Allocate at least 512MB RAM
- **Storage**: Ephemeral (no persistent data)
- **Networking**: HTTP only (HTTPS handled by platform)
- **Monitoring**: Health check endpoint configured

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Issues**: GitHub Issues
- **Documentation**: See `models/README.md` for AI setup
- **Testing**: Run `npm test` for validation
- **Health Check**: `curl http://localhost:8080/api/health`

---

**Built with ❤️ for the CAD community**