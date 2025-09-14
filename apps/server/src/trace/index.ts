// filename: apps/server/src/trace/index.ts
import { PNG } from 'pngjs';
import { processWithHED } from './hed';
import { preprocessRaster, binarizeImage, morphologyCleanup, removeSpeckles } from './raster';
import { extractContours, simplifyContours } from './contour';
import { validateGeometry, cleanupGeometry } from './geometry';
import { generateSVG } from './svg';
import { generateDXF } from './dxf';
import type { TraceRequest, TraceResponse, ImageData, ProcessingOptions, Polygon } from '@shared/types';

/**
 * Main entry point for the Tier-2 AI-assisted tracing pipeline
 * Converts PNG buffer to SVG/DXF with deterministic vectorization
 */
export async function traceImage(pngBuffer: Buffer, request: TraceRequest): Promise<TraceResponse> {
  const startTime = Date.now();
  const timings = {
    preprocessing: 0,
    aiProcessing: 0,
    vectorization: 0,
    export: 0,
    total: 0,
  };

  try {
    // Step 1: Decode PNG image
    const preprocessStart = Date.now();
    const png = PNG.sync.read(pngBuffer);
    const imageData: ImageData = {
      width: png.width,
      height: png.height,
      data: png.data,
    };

    console.log(`Loaded PNG: ${imageData.width}x${imageData.height}`);

    // Step 2: Calculate processing parameters based on fidelity
    const options = calculateProcessingOptions(request, imageData);
    console.log(`Processing options: epsilon=${options.epsilon}, areaMin=${options.areaMin}, threshold=${options.threshold}`);

    // Step 3: AI preprocessing (optional)
    let processedImage = imageData;
    if (request.useAI) {
      const aiStart = Date.now();
      try {
        // Apply HED edge detection for crisp edges
        processedImage = await processWithHED(imageData);
        console.log('Applied HED edge detection');
      } catch (error) {
        console.warn('HED processing failed, falling back to deterministic pipeline:', error);
        // Continue with original image if AI fails
      }
      timings.aiProcessing = Date.now() - aiStart;
    }

    // Step 4: Deterministic raster processing
    let binaryImage = binarizeImage(processedImage, options.threshold);
    binaryImage = morphologyCleanup(binaryImage);
    binaryImage = removeSpeckles(binaryImage, options.areaMin);
    
    timings.preprocessing = Date.now() - preprocessStart;

    // Step 5: Vectorization
    const vectorStart = Date.now();
    let contours = extractContours(binaryImage);
    contours = simplifyContours(contours, options.epsilon);
    
    // Step 6: Geometry validation and cleanup
    let polygons = contours.map(contour => ({
      exterior: contour.points,
      holes: contour.holes || [],
    }));
    
    polygons = validateGeometry(polygons);
    polygons = cleanupGeometry(polygons, options.areaMin);
    
    timings.vectorization = Date.now() - vectorStart;

    // Step 7: Export to SVG and DXF
    const exportStart = Date.now();
    const svg = generateSVG(polygons, imageData.width, imageData.height, request.whiteFill);
    const dxf = generateDXF(polygons, imageData.width, imageData.height, request.whiteFill);
    timings.export = Date.now() - exportStart;

    // Step 8: Calculate metrics
    const nodeCount = polygons.reduce((total, poly) => {
      return total + poly.exterior.length + poly.holes.reduce((holeTotal, hole) => holeTotal + hole.length, 0);
    }, 0);

    const simplificationRatio = options.epsilon / Math.max(imageData.width, imageData.height);

    const response: TraceResponse = {
      svg,
      dxf: Buffer.from(dxf).toString('base64'),
      metrics: {
        nodeCount,
        polygonCount: polygons.length,
        simplification: simplificationRatio,
        timings,
      },
    };

    return response;

  } catch (error) {
    console.error('Trace processing failed:', error);
    throw new Error(`Trace processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate processing parameters based on fidelity level and image characteristics
 */
function calculateProcessingOptions(request: TraceRequest, imageData: ImageData): ProcessingOptions {
  const { fidelity, threshold, despeckleAreaMin } = request;
  
  // Map fidelity (0-100) to processing parameters
  const fidelityNorm = fidelity / 100; // 0.0 to 1.0
  
  // Simplification epsilon: higher fidelity = lower epsilon (more detail)
  // Scale based on image size for consistent results
  const baseEpsilon = Math.max(imageData.width, imageData.height) * 0.002; // 0.2% of max dimension
  const epsilon = baseEpsilon * (1 - fidelityNorm * 0.8); // Range: 0.2% to 1.0% of image size
  
  // Speckle removal: higher fidelity = smaller minimum area
  const baseAreaMin = Math.max(imageData.width, imageData.height) * 0.0001; // 0.01% of max dimension
  const areaMin = despeckleAreaMin || (baseAreaMin * (1 - fidelityNorm * 0.9)); // Range: 0.001% to 0.01%
  
  // Binary threshold: use provided value or auto-calculate
  const binaryThreshold = threshold !== undefined ? threshold : 128;

  return {
    epsilon: Math.max(0.1, epsilon), // Minimum 0.1px
    areaMin: Math.max(1, areaMin), // Minimum 1px²
    threshold: binaryThreshold,
    useAI: request.useAI || false,
  };
}