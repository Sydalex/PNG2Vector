// filename: apps/server/src/trace/index.ts
import { PNG } from 'pngjs';
import { extractContours, simplifyContours } from './contour';
import { validateGeometry, cleanupGeometry } from './geometry';
import { processWithHED } from './hed';
import { preprocessRaster, binarizeImage, removeSpeckles } from './raster';
import { generateSVG } from './svg';
import { generateDXF } from './dxf';
import type { TraceRequest, TraceResponse, ImageData, Polygon, ProcessingOptions } from '../../../../shared/types';

/**
 * Main image tracing function - implements the AI-assisted Tier-2 pipeline
 */
export async function traceImage(buffer: Buffer, request: TraceRequest): Promise<TraceResponse> {
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
    const png = PNG.sync.read(buffer);
    const imageData: ImageData = {
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
        processedImage = await processWithHED(imageData);
        timings.aiProcessing = Date.now() - aiStart;
        console.log(`AI preprocessing completed in ${timings.aiProcessing}ms`);
      } catch (error) {
        console.warn('AI preprocessing failed, falling back to deterministic pipeline:', error);
        processedImage = imageData;
      }
    }

    // 3. Deterministic raster processing
    const options = calculateProcessingOptions(request);
    
    // Preprocess raster (blur, threshold, morphology)
    processedImage = preprocessRaster(processedImage, {
      threshold: options.threshold,
    });
    
    // Binarize with threshold
    processedImage = binarizeImage(processedImage, options.threshold);
    
    // Remove speckles
    processedImage = removeSpeckles(processedImage, options.areaMin);
    
    timings.preprocessing = Date.now() - preprocessStart;

    // 4. Vectorization
    const vectorStart = Date.now();
    
    // Extract contours using Moore neighborhood tracing
    const contours = extractContours(processedImage);
    console.log(`Extracted ${contours.length} raw contours`);
    
    // Simplify contours with Douglas-Peucker
    const simplifiedContours = simplifyContours(contours, options.epsilon);
    console.log(`Simplified to ${simplifiedContours.length} contours with epsilon ${options.epsilon}`);
    
    // Convert to polygons
    const polygons: Polygon[] = simplifiedContours.map(contour => ({
      exterior: contour.points,
      holes: contour.holes,
    }));
    
    // Validate and clean geometry
    const validatedPolygons = validateGeometry(polygons);
    const cleanPolygons = cleanupGeometry(validatedPolygons, options.areaMin);
    
    timings.vectorization = Date.now() - vectorStart;
    console.log(`Vectorization completed: ${cleanPolygons.length} final polygons`);

    // 5. Export generation
    const exportStart = Date.now();
    
    // Generate SVG
    const svg = generateSVG(cleanPolygons, imageData.width, imageData.height, request.whiteFill);
    
    // Generate DXF  
    const dxf = generateDXF(cleanPolygons, imageData.width, imageData.height, request.whiteFill);
    const dxfBase64 = Buffer.from(dxf, 'utf8').toString('base64');
    
    timings.export = Date.now() - exportStart;
    timings.total = Date.now() - startTime;

    // Calculate metrics
    const nodeCount = cleanPolygons.reduce((total, poly) => {
      return total + poly.exterior.length + poly.holes.reduce((holeTotal, hole) => holeTotal + hole.length, 0);
    }, 0);

    const response: TraceResponse = {
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

  } catch (error) {
    console.error('Trace processing failed:', error);
    throw error;
  }
}

/**
 * Calculate processing options from fidelity and other parameters
 */
function calculateProcessingOptions(request: TraceRequest): ProcessingOptions {
  const fidelity = request.fidelity;
  
  // Base values for medium fidelity (50)
  const baseEpsilon = 2.0;
  const baseAreaMin = 100;
  
  // Map fidelity (0-100) to processing parameters
  // Higher fidelity = lower epsilon (more detail), smaller minimum area
  const epsilon = baseEpsilon * (1 - (fidelity / 100) * 0.8); // Range: 0.4 - 2.0
  const areaMin = baseAreaMin * (1 - (fidelity / 100) * 0.9); // Range: 10 - 100
  
  const options: ProcessingOptions = {
    epsilon: Math.max(0.1, epsilon),
    areaMin: Math.max(1, request.despeckleAreaMin || areaMin),
    threshold: request.threshold || 128,
    useAI: request.useAI || false,
  };
  
  console.log(`Processing options: epsilon=${options.epsilon.toFixed(2)}, areaMin=${options.areaMin}, threshold=${options.threshold}`);
  return options;
}
