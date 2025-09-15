"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processWithHED = processWithHED;
// filename: apps/server/src/trace/hed.ts
const ort = __importStar(require("onnxruntime-node"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let hedSession = null;
/**
 * Initialize HED (Holistically-Nested Edge Detection) ONNX model
 * Falls back gracefully if model is not available
 */
async function initializeHED() {
    if (hedSession) {
        return hedSession;
    }
    try {
        const modelPath = path_1.default.join(process.cwd(), 'models', 'hed.onnx');
        if (!fs_1.default.existsSync(modelPath)) {
            console.warn('HED model not found at:', modelPath);
            console.warn('AI preprocessing will be disabled. Place hed.onnx in the models/ directory to enable.');
            return null;
        }
        console.log('Loading HED model from:', modelPath);
        hedSession = await ort.InferenceSession.create(modelPath, {
            executionProviders: ['cpu'], // Use CPU for compatibility
            logSeverityLevel: 3, // Only errors
        });
        console.log('HED model loaded successfully');
        return hedSession;
    }
    catch (error) {
        console.error('Failed to load HED model:', error);
        return null;
    }
}
/**
 * Process image with HED edge detection
 * Returns enhanced image with crisp 1-pixel edges
 */
async function processWithHED(imageData) {
    const session = await initializeHED();
    if (!session) {
        console.warn('HED model not available, returning original image');
        return imageData;
    }
    try {
        // Prepare input tensor (normalize to 0-1, RGB format)
        const inputTensor = preprocessForHED(imageData);
        // Run inference
        const feeds = { input: inputTensor };
        const results = await session.run(feeds);
        // Get edge map output
        const edgeMap = results.output;
        if (!edgeMap || edgeMap.dims.length !== 4) {
            throw new Error('Invalid HED output format');
        }
        // Post-process edge map back to ImageData format
        const processedImage = postprocessHED(edgeMap, imageData.width, imageData.height);
        console.log('HED edge detection completed');
        return processedImage;
    }
    catch (error) {
        console.error('HED processing error:', error);
        throw error;
    }
}
/**
 * Preprocess image data for HED model input
 * Expected format: [1, 3, H, W] float32 tensor, normalized 0-1
 */
function preprocessForHED(imageData) {
    const { width, height, data } = imageData;
    // Convert RGBA to RGB and normalize to 0-1
    const rgbData = new Float32Array(3 * width * height);
    for (let i = 0; i < width * height; i++) {
        const pixelIndex = i * 4; // RGBA
        const rgbIndex = i * 3; // RGB
        // Normalize from 0-255 to 0-1
        rgbData[rgbIndex] = data[pixelIndex] / 255.0; // R
        rgbData[rgbIndex + 1] = data[pixelIndex + 1] / 255.0; // G
        rgbData[rgbIndex + 2] = data[pixelIndex + 2] / 255.0; // B
    }
    // Reshape to [1, 3, H, W] format expected by HED
    const reshapedData = new Float32Array(3 * width * height);
    // Channel-first format: RRR...GGG...BBB...
    for (let c = 0; c < 3; c++) {
        for (let h = 0; h < height; h++) {
            for (let w = 0; w < width; w++) {
                const srcIndex = (h * width + w) * 3 + c;
                const dstIndex = c * width * height + h * width + w;
                reshapedData[dstIndex] = rgbData[srcIndex];
            }
        }
    }
    return new ort.Tensor('float32', reshapedData, [1, 3, height, width]);
}
/**
 * Post-process HED output back to ImageData format
 * Applies edge enhancement and converts to binary edge map
 */
function postprocessHED(edgeTensor, width, height) {
    const edgeData = edgeTensor.data;
    // Create output RGBA data
    const outputData = new Uint8Array(width * height * 4);
    // Convert edge probabilities to binary edges
    // HED outputs edge probabilities in range 0-1
    for (let i = 0; i < width * height; i++) {
        const edgeProb = edgeData[i];
        // Apply threshold and enhance edges
        const isEdge = edgeProb > 0.5;
        const edgeValue = isEdge ? 0 : 255; // Black edges, white background
        const pixelIndex = i * 4;
        outputData[pixelIndex] = edgeValue; // R
        outputData[pixelIndex + 1] = edgeValue; // G
        outputData[pixelIndex + 2] = edgeValue; // B
        outputData[pixelIndex + 3] = 255; // A (fully opaque)
    }
    return {
        width,
        height,
        data: outputData,
    };
}
/**
 * Cleanup HED session on process exit
 */
process.on('exit', () => {
    if (hedSession) {
        hedSession.release();
    }
});
process.on('SIGINT', () => {
    if (hedSession) {
        hedSession.release();
    }
    process.exit(0);
});
//# sourceMappingURL=hed.js.map