import type { ImageData } from '../../../../shared/types';
/**
 * Raster processing utilities for deterministic image preprocessing
 * All operations are fully deterministic and reproducible
 */
/**
 * Convert RGBA image to grayscale using luminance formula
 */
export declare function toGrayscale(imageData: ImageData): ImageData;
/**
 * Apply Gaussian blur for noise reduction
 * Uses separable 1D kernels for efficiency
 */
export declare function gaussianBlur(imageData: ImageData, radius?: number): ImageData;
/**
 * Binarize image using threshold
 * Converts to pure black/white based on luminance
 */
export declare function binarizeImage(imageData: ImageData, threshold?: number): ImageData;
/**
 * Apply morphological operations for cleanup
 * Performs closing (dilation + erosion) to fill small gaps
 */
export declare function morphologyCleanup(imageData: ImageData, iterations?: number): ImageData;
/**
 * Remove small speckles/noise based on connected component area
 */
export declare function removeSpeckles(imageData: ImageData, minArea: number): ImageData;
/**
 * Preprocess raster image with standard pipeline
 */
export declare function preprocessRaster(imageData: ImageData, options?: {
    blur?: number;
    threshold?: number;
}): ImageData;
//# sourceMappingURL=raster.d.ts.map