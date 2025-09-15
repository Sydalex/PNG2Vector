import type { ImageData } from '../../../../shared/types';

/**
 * Raster processing utilities for deterministic image preprocessing
 * All operations are fully deterministic and reproducible
 */

/**
 * Convert RGBA image to grayscale using luminance formula
 */
export function toGrayscale(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  const grayscaleData = new Uint8Array(width * height * 4);
  
  for (let i = 0; i < width * height; i++) {
    const pixelIndex = i * 4;
    
    // Luminance formula: 0.299*R + 0.587*G + 0.114*B
    const r = data[pixelIndex];
    const g = data[pixelIndex + 1];
    const b = data[pixelIndex + 2];
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    
    grayscaleData[pixelIndex] = gray;     // R
    grayscaleData[pixelIndex + 1] = gray; // G
    grayscaleData[pixelIndex + 2] = gray; // B
    grayscaleData[pixelIndex + 3] = data[pixelIndex + 3]; // A (preserve alpha)
  }
  
  return {
    width,
    height,
    data: grayscaleData,
  };
}

/**
 * Apply Gaussian blur for noise reduction
 * Uses separable 1D kernels for efficiency
 */
export function gaussianBlur(imageData: ImageData, radius: number = 1): ImageData {
  if (radius <= 0) return imageData;
  
  const { width, height, data } = imageData;
  
  // Generate 1D Gaussian kernel
  const kernel = generateGaussianKernel(radius);
  const kernelSize = kernel.length;
  const halfKernel = Math.floor(kernelSize / 2);
  
  // Horizontal pass
  const tempData = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      
      for (let k = 0; k < kernelSize; k++) {
        const sampleX = Math.max(0, Math.min(width - 1, x + k - halfKernel));
        const sampleIndex = (y * width + sampleX) * 4;
        const weight = kernel[k];
        
        r += data[sampleIndex] * weight;
        g += data[sampleIndex + 1] * weight;
        b += data[sampleIndex + 2] * weight;
        a += data[sampleIndex + 3] * weight;
      }
      
      const pixelIndex = (y * width + x) * 4;
      tempData[pixelIndex] = Math.round(r);
      tempData[pixelIndex + 1] = Math.round(g);
      tempData[pixelIndex + 2] = Math.round(b);
      tempData[pixelIndex + 3] = Math.round(a);
    }
  }
  
  // Vertical pass
  const blurredData = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      
      for (let k = 0; k < kernelSize; k++) {
        const sampleY = Math.max(0, Math.min(height - 1, y + k - halfKernel));
        const sampleIndex = (sampleY * width + x) * 4;
        const weight = kernel[k];
        
        r += tempData[sampleIndex] * weight;
        g += tempData[sampleIndex + 1] * weight;
        b += tempData[sampleIndex + 2] * weight;
        a += tempData[sampleIndex + 3] * weight;
      }
      
      const pixelIndex = (y * width + x) * 4;
      blurredData[pixelIndex] = Math.round(r);
      blurredData[pixelIndex + 1] = Math.round(g);
      blurredData[pixelIndex + 2] = Math.round(b);
      blurredData[pixelIndex + 3] = Math.round(a);
    }
  }
  
  return {
    width,
    height,
    data: blurredData,
  };
}

/**
 * Binarize image using threshold
 * Converts to pure black/white based on luminance
 */
export function binarizeImage(imageData: ImageData, threshold: number = 128): ImageData {
  const { width, height, data } = imageData;
  const binaryData = new Uint8Array(width * height * 4);
  
  for (let i = 0; i < width * height; i++) {
    const pixelIndex = i * 4;
    
    // Calculate luminance
    const r = data[pixelIndex];
    const g = data[pixelIndex + 1];
    const b = data[pixelIndex + 2];
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Apply threshold
    const binaryValue = luminance >= threshold ? 255 : 0;
    
    binaryData[pixelIndex] = binaryValue;     // R
    binaryData[pixelIndex + 1] = binaryValue; // G
    binaryData[pixelIndex + 2] = binaryValue; // B
    binaryData[pixelIndex + 3] = 255;         // A (fully opaque)
  }
  
  return {
    width,
    height,
    data: binaryData,
  };
}

/**
 * Apply morphological operations for cleanup
 * Performs closing (dilation + erosion) to fill small gaps
 */
export function morphologyCleanup(imageData: ImageData, iterations: number = 1): ImageData {
  let result = imageData;
  
  // Apply closing operation (dilation followed by erosion)
  for (let i = 0; i < iterations; i++) {
    result = morphologyDilation(result);
    result = morphologyErosion(result);
  }
  
  return result;
}

/**
 * Remove small speckles/noise based on connected component area
 */
export function removeSpeckles(imageData: ImageData, minArea: number): ImageData {
  const { width, height, data } = imageData;
  const visited = new Array(width * height).fill(false);
  const cleanedData = new Uint8Array(data);
  
  // Find and remove small connected components
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const pixelIndex = index * 4;
      
      if (!visited[index] && data[pixelIndex] === 0) { // Black pixel (foreground)
        const component = floodFill(imageData, x, y, visited);
        
        if (component.length < minArea) {
          // Remove small component by setting to white
          for (const pixelIdx of component) {
            cleanedData[pixelIdx * 4] = 255;     // R
            cleanedData[pixelIdx * 4 + 1] = 255; // G
            cleanedData[pixelIdx * 4 + 2] = 255; // B
          }
        }
      }
    }
  }
  
  return {
    width,
    height,
    data: cleanedData,
  };
}

/**
 * Preprocess raster image with standard pipeline
 */
export function preprocessRaster(imageData: ImageData, options: { blur?: number; threshold?: number } = {}): ImageData {
  let processed = imageData;
  
  // Convert to grayscale
  processed = toGrayscale(processed);
  
  // Apply slight blur to reduce noise
  if (options.blur && options.blur > 0) {
    processed = gaussianBlur(processed, options.blur);
  }
  
  // Binarize
  processed = binarizeImage(processed, options.threshold || 128);
  
  return processed;
}

// Helper functions

function generateGaussianKernel(radius: number): number[] {
  const size = Math.ceil(radius * 2) * 2 + 1; // Ensure odd size
  const kernel = new Array(size);
  const sigma = radius / 3; // Standard deviation
  const twoSigmaSquared = 2 * sigma * sigma;
  const center = Math.floor(size / 2);
  let sum = 0;
  
  // Generate kernel values
  for (let i = 0; i < size; i++) {
    const distance = i - center;
    kernel[i] = Math.exp(-(distance * distance) / twoSigmaSquared);
    sum += kernel[i];
  }
  
  // Normalize kernel
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }
  
  return kernel;
}

function morphologyDilation(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  const dilatedData = new Uint8Array(width * height * 4);
  
  // 3x3 structuring element
  const kernel = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],  [0, 0],  [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minValue = 255;
      
      // Check all kernel positions
      for (const [dy, dx] of kernel) {
        const ny = y + dy;
        const nx = x + dx;
        
        if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
          const sampleIndex = (ny * width + nx) * 4;
          minValue = Math.min(minValue, data[sampleIndex]);
        }
      }
      
      const pixelIndex = (y * width + x) * 4;
      dilatedData[pixelIndex] = minValue;
      dilatedData[pixelIndex + 1] = minValue;
      dilatedData[pixelIndex + 2] = minValue;
      dilatedData[pixelIndex + 3] = 255;
    }
  }
  
  return { width, height, data: dilatedData };
}

function morphologyErosion(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  const erodedData = new Uint8Array(width * height * 4);
  
  // 3x3 structuring element
  const kernel = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],  [0, 0],  [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let maxValue = 0;
      
      // Check all kernel positions
      for (const [dy, dx] of kernel) {
        const ny = y + dy;
        const nx = x + dx;
        
        if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
          const sampleIndex = (ny * width + nx) * 4;
          maxValue = Math.max(maxValue, data[sampleIndex]);
        }
      }
      
      const pixelIndex = (y * width + x) * 4;
      erodedData[pixelIndex] = maxValue;
      erodedData[pixelIndex + 1] = maxValue;
      erodedData[pixelIndex + 2] = maxValue;
      erodedData[pixelIndex + 3] = 255;
    }
  }
  
  return { width, height, data: erodedData };
}

function floodFill(imageData: ImageData, startX: number, startY: number, visited: boolean[]): number[] {
  const { width, height, data } = imageData;
  const component: number[] = [];
  const stack: [number, number][] = [[startX, startY]];
  
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const index = y * width + x;
    
    if (x < 0 || x >= width || y < 0 || y >= height || visited[index]) {
      continue;
    }
    
    const pixelIndex = index * 4;
    if (data[pixelIndex] !== 0) { // Not black (foreground)
      continue;
    }
    
    visited[index] = true;
    component.push(index);
    
    // Add 4-connected neighbors
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  
  return component;
}