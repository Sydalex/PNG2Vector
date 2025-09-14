// filename: apps/server/src/index.ts
console.log('🚀 Starting PNG2Vector server...');

// Add global error handlers before any imports
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('📦 Loading express...');
import express from 'express';
console.log('✅ Express loaded');
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import multer from 'multer';
import path from 'path';
console.log('📦 Loading trace module...');
// Import trace module with fallback
let traceImage: any;
try {
  const traceModule = require('./trace');
  traceImage = traceModule.traceImage;
  console.log('✅ Trace module loaded successfully');
} catch (error) {
  console.error('❌ Failed to load trace module:', error);
  // Fallback mock function
  traceImage = async (buffer: Buffer, request: any) => {
    console.log('Using fallback trace function');
    return {
      svg: '<svg></svg>',
      dxf: 'RkFMTEJBQ0s=', // base64 for 'FALLBACK'
      metrics: {
        nodeCount: 0,
        polygonCount: 0,
        simplification: 0,
        timings: { total: 0, preprocessing: 0, vectorization: 0, export: 0 }
      }
    };
  };
}
console.log('📦 Loading shared types...');
import type { TraceRequest, TraceResponse, ErrorResponse } from '../../../shared/types';
console.log('✅ All imports loaded successfully');

const app = express();
const PORT = process.env.PORT || 8080;

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
    },
  },
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only PNG files are allowed'));
    }
  },
});

// Serve static files (built frontend)
app.use(express.static(path.join(__dirname, '../public')));

// Root endpoint - redirect to health check or serve info
app.get('/', (req, res) => {
  res.json({
    name: 'PNG2Vector API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      trace: 'POST /api/trace'
    },
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Main trace endpoint
app.post('/api/trace', upload.single('image'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Validate file upload
    if (!req.file) {
      const error: ErrorResponse = {
        error: 'No image file provided',
        code: 'MISSING_FILE'
      };
      return res.status(400).json(error);
    }

    // Parse and validate request parameters
    const fidelity = parseInt(req.body.fidelity || '50', 10);
    const whiteFill = req.body.whiteFill === 'true';
    const threshold = req.body.threshold ? parseInt(req.body.threshold, 10) : undefined;
    const despeckleAreaMin = req.body.despeckleAreaMin ? parseInt(req.body.despeckleAreaMin, 10) : undefined;
    const useAI = req.body.useAI === 'true';

    // Validate fidelity range
    if (fidelity < 0 || fidelity > 100) {
      const error: ErrorResponse = {
        error: 'Fidelity must be between 0 and 100',
        code: 'INVALID_FIDELITY'
      };
      return res.status(400).json(error);
    }

    // Validate threshold if provided
    if (threshold !== undefined && (threshold < 0 || threshold > 255)) {
      const error: ErrorResponse = {
        error: 'Threshold must be between 0 and 255',
        code: 'INVALID_THRESHOLD'
      };
      return res.status(400).json(error);
    }

    const traceRequest: TraceRequest = {
      fidelity,
      whiteFill,
      threshold,
      despeckleAreaMin,
      useAI,
    };

    console.log(`Processing trace request: fidelity=${fidelity}, whiteFill=${whiteFill}, useAI=${useAI}`);

    // Process the image
    const result = await traceImage(req.file.buffer, traceRequest);
    
    // Add total processing time
    result.metrics.timings.total = Date.now() - startTime;

    console.log(`Trace completed in ${result.metrics.timings.total}ms: ${result.metrics.polygonCount} polygons, ${result.metrics.nodeCount} nodes`);

    return res.json(result);

  } catch (error) {
    console.error('Trace processing error:', error);
    
    const errorResponse: ErrorResponse = {
      error: 'Internal processing error',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'PROCESSING_ERROR'
    };
    
    return res.status(500).json(errorResponse);
  }
});

// Catch-all handler for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      const errorResponse: ErrorResponse = {
        error: 'File too large',
        details: 'Maximum file size is 50MB',
        code: 'FILE_TOO_LARGE'
      };
      return res.status(413).json(errorResponse);
    }
  }

  const errorResponse: ErrorResponse = {
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    code: 'INTERNAL_ERROR'
  };
  
  return res.status(500).json(errorResponse);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 PNG2Vector server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🎯 API endpoint: http://localhost:${PORT}/api/trace`);
  console.log(`📁 Serving static files from: ${path.join(__dirname, '../public')}`);
  console.log(`📁 Current working directory: ${process.cwd()}`);
  console.log(`📁 Server file location: ${__dirname}`);
  console.log(`🚀 Server started successfully with relative imports!`);
});

export default app;