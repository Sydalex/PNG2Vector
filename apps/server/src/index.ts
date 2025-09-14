// filename: apps/server/src/index.ts
// Simplified version to test imports step by step
console.log('🚀 Starting PNG2Vector server...');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const multer = require('multer');
const path = require('path');

console.log('✅ Basic imports loaded');
// Simple trace mock function
const traceImage = async (buffer: any, request: any) => {
  return {
    svg: '<svg><rect width="100" height="100" fill="white"/></svg>',
    dxf: Buffer.from('MOCK DXF CONTENT').toString('base64'),
    metrics: {
      nodeCount: 4,
      polygonCount: 1,
      simplification: 1.0,
      timings: { total: 100, preprocessing: 50, vectorization: 30, export: 20 }
    }
  };
};

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
  fileFilter: (req: any, file: any, cb: any) => {
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
app.get('/', (req: any, res: any) => {
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
app.get('/api/health', (req: any, res: any) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Main trace endpoint
app.post('/api/trace', upload.single('image'), async (req: any, res: any) => {
  const startTime = Date.now();
  
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        error: 'No image file provided',
        code: 'MISSING_FILE'
      });
    }

    // Parse parameters
    const fidelity = parseInt(req.body.fidelity || '50', 10);
    const whiteFill = req.body.whiteFill === 'true';
    const useAI = req.body.useAI === 'true';

    console.log(`Processing trace request: fidelity=${fidelity}, whiteFill=${whiteFill}, useAI=${useAI}`);

    // Process the image with mock function
    const result = await traceImage(req.file.buffer, { fidelity, whiteFill, useAI });
    
    // Add total processing time
    result.metrics.timings.total = Date.now() - startTime;

    console.log(`Trace completed in ${result.metrics.timings.total}ms`);

    return res.json(result);

  } catch (error) {
    console.error('Trace processing error:', error);
    
    return res.status(500).json({
      error: 'Internal processing error',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'PROCESSING_ERROR'
    });
  }
});

// Catch-all handler for SPA routing
app.get('*', (req: any, res: any) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global error handler
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', error);
  
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large',
      details: 'Maximum file size is 50MB'
    });
  }

  return res.status(500).json({
    error: 'Internal server error',
    details: error.message
  });
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