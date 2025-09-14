// filename: apps/server/src/index.ts
// Register path mappings for runtime
import 'module-alias/register';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import multer from 'multer';
import path from 'path';
import { traceImage } from './trace';
import type { TraceRequest, TraceResponse, ErrorResponse } from '@shared/types';

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
});

export default app;