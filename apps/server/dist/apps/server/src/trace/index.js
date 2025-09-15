"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.traceImage = traceImage;
// filename: apps/server/src/trace/index.ts
const pngjs_1 = require("pngjs");
const contour_1 = require("./contour");
const geometry_1 = require("./geometry");
const hed_1 = require("./hed");
const raster_1 = require("./raster");
const svg_1 = require("./svg");
const dxf_1 = require("./dxf");
/**
 * Main image tracing function - implements the AI-assisted Tier-2 pipeline
 */
async function traceImage(buffer, request) {
    const startTime = Date.now();
    let timings = {
        preprocessing: 0,
        aiProcessing: 0,
        vectorization: 0,
        export: 0,
        total: 0,
    };
    try {
        // 1. Load and parse PNG image
        const preprocessStart = Date.now();
        const png = pngjs_1.PNG.sync.read(buffer);
        const imageData = {
            width: png.width,
            height: png.height,
            data: new Uint8Array(png.data),
        };
        console.log(`Loaded PNG: ${imageData.width}x${imageData.height}`);
        // 2. Optional AI preprocessing
        let processedImage = imageData;
        if (request.useAI) {
            try {
                const aiStart = Date.now();
                processedImage = await (0, hed_1.processWithHED)(imageData);
                timings.aiProcessing = Date.now() - aiStart;
                console.log(`AI preprocessing completed in ${timings.aiProcessing}ms`);
            }
            catch (error) {
                console.warn('AI preprocessing failed, falling back to deterministic pipeline:', error);
                processedImage = imageData;
            }
        }
        // 3. Deterministic raster processing
        const options = calculateProcessingOptions(request);
        // Preprocess raster (blur, threshold, morphology)
        processedImage = (0, raster_1.preprocessRaster)(processedImage, {
            threshold: options.threshold,
        });
        // Binarize with threshold
        processedImage = (0, raster_1.binarizeImage)(processedImage, options.threshold);
        // Remove speckles
        processedImage = (0, raster_1.removeSpeckles)(processedImage, options.areaMin);
        timings.preprocessing = Date.now() - preprocessStart;
        // 4. Vectorization
        const vectorStart = Date.now();
        // Extract contours using Moore neighborhood tracing
        const contours = (0, contour_1.extractContours)(processedImage);
        console.log(`Extracted ${contours.length} raw contours`);
        // Simplify contours with Douglas-Peucker
        const simplifiedContours = (0, contour_1.simplifyContours)(contours, options.epsilon);
        console.log(`Simplified to ${simplifiedContours.length} contours with epsilon ${options.epsilon}`);
        // Convert to polygons
        const polygons = simplifiedContours.map(contour => ({
            exterior: contour.points,
            holes: contour.holes,
        }));
        // Validate and clean geometry
        const validatedPolygons = (0, geometry_1.validateGeometry)(polygons);
        const cleanPolygons = (0, geometry_1.cleanupGeometry)(validatedPolygons, options.areaMin);
        timings.vectorization = Date.now() - vectorStart;
        console.log(`Vectorization completed: ${cleanPolygons.length} final polygons`);
        // 5. Export generation
        const exportStart = Date.now();
        // Generate SVG
        const svg = (0, svg_1.generateSVG)(cleanPolygons, imageData.width, imageData.height, request.whiteFill);
        // Generate DXF  
        const dxf = (0, dxf_1.generateDXF)(cleanPolygons, imageData.width, imageData.height, request.whiteFill);
        const dxfBase64 = Buffer.from(dxf, 'utf8').toString('base64');
        timings.export = Date.now() - exportStart;
        timings.total = Date.now() - startTime;
        // Calculate metrics
        const nodeCount = cleanPolygons.reduce((total, poly) => {
            return total + poly.exterior.length + poly.holes.reduce((holeTotal, hole) => holeTotal + hole.length, 0);
        }, 0);
        const response = {
            svg,
            dxf: dxfBase64,
            metrics: {
                nodeCount,
                polygonCount: cleanPolygons.length,
                simplification: options.epsilon,
                timings,
            },
        };
        return response;
    }
    catch (error) {
        console.error('Trace processing failed:', error);
        throw error;
    }
}
/**
 * Calculate processing options from fidelity and other parameters
 */
function calculateProcessingOptions(request) {
    const fidelity = request.fidelity;
    // Base values for medium fidelity (50)
    const baseEpsilon = 2.0;
    const baseAreaMin = 100;
    // Map fidelity (0-100) to processing parameters
    // Higher fidelity = lower epsilon (more detail), smaller minimum area
    const epsilon = baseEpsilon * (1 - (fidelity / 100) * 0.8); // Range: 0.4 - 2.0
    const areaMin = baseAreaMin * (1 - (fidelity / 100) * 0.9); // Range: 10 - 100
    const options = {
        epsilon: Math.max(0.1, epsilon),
        areaMin: Math.max(1, request.despeckleAreaMin || areaMin),
        threshold: request.threshold || 128,
        useAI: request.useAI || false,
    };
    console.log(`Processing options: epsilon=${options.epsilon.toFixed(2)}, areaMin=${options.areaMin}, threshold=${options.threshold}`);
    return options;
}
//# sourceMappingURL=index.js.map