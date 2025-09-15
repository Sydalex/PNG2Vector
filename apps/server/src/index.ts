import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import multer from 'multer';
import path from 'path';
import { traceImage } from './trace/index';
import type { TraceRequest } from '../../../shared/types';

const app = express();
const PORT = process.env.PORT || 8080;

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development, adjust for production
}));
app.use(cors());
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only PNG files are allowed'));
    }
  },
});

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '../public')));

// API endpoints
app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Main tracing endpoint
app.post('/api/trace', upload.single('image'), async (req, res): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        error: 'No image file provided',
        code: 'MISSING_FILE'
      });
      return;
    }

    // Parse and validate request parameters
    const fidelity = parseInt(req.body.fidelity) || 75;
    const threshold = parseInt(req.body.threshold) || 128;
    const whiteFill = req.body.whiteFill === 'true';
    const useAI = req.body.useAI === 'true';
    const despeckleAreaMin = parseInt(req.body.despeckleAreaMin) || undefined;

    if (fidelity < 0 || fidelity > 100) {
      res.status(400).json({
        error: 'Fidelity must be between 0 and 100',
        code: 'INVALID_FIDELITY'
      });
      return;
    }

    if (threshold < 0 || threshold > 255) {
      res.status(400).json({
        error: 'Threshold must be between 0 and 255',
        code: 'INVALID_THRESHOLD'
      });
      return;
    }

    const traceRequest: TraceRequest = {
      fidelity,
      threshold,
      whiteFill,
      useAI,
      despeckleAreaMin,
    };

    console.log(`Processing ${req.file.originalname} (${req.file.size} bytes) with fidelity=${fidelity}`);

    // Process the image
    const result = await traceImage(req.file.buffer, traceRequest);

    res.json(result);

  } catch (error: any) {
    console.error('Trace API error:', error);
    res.status(500).json({
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      code: 'PROCESSING_ERROR'
    });
  }
});

// Catch-all handler: send back the frontend's index.html file
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../public/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(404).json({
        error: 'Frontend not found',
        message: 'The frontend application could not be loaded.'
      });
    }
  });
});

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    code: 'UNHANDLED_ERROR'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 PNG2Vector server running on port ${PORT}`);
  console.log(`🔗 Open http://localhost:${PORT} in your browser`);
});

export default app;
