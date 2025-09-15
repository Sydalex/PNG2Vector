"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const index_1 = require("./trace/index");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8080;
// Security and performance middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // Disable for development, adjust for production
}));
app.use((0, cors_1.default)());
app.use((0, compression_1.default)());
// Body parsing middleware
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Configure multer for file uploads
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/png') {
            cb(null, true);
        }
        else {
            cb(new Error('Only PNG files are allowed'));
        }
    },
});
// Serve static files from the web build (frontend)
const publicPath = path_1.default.join(__dirname, '../public');
app.use(express_1.default.static(publicPath));
// API endpoints
app.get('/api/health', (req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
});
// Main tracing endpoint
app.post('/api/trace', upload.single('image'), async (req, res) => {
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
        const traceRequest = {
            fidelity,
            threshold,
            whiteFill,
            useAI,
            despeckleAreaMin,
        };
        console.log(`Processing ${req.file.originalname} (${req.file.size} bytes) with fidelity=${fidelity}`);
        // Process the image
        const result = await (0, index_1.traceImage)(req.file.buffer, traceRequest);
        res.json(result);
    }
    catch (error) {
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
    const indexPath = path_1.default.join(publicPath, 'index.html');
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
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        code: 'UNHANDLED_ERROR'
    });
});
app.listen(PORT, () => {
    console.log(`🚀 PNG2Vector server running on port ${PORT}`);
    console.log(`📁 Serving frontend from: ${publicPath}`);
    console.log(`🔗 Open http://localhost:${PORT} in your browser`);
});
exports.default = app;
//# sourceMappingURL=index.js.map