// filename: apps/server/src/trace/contour.ts
import simplify from 'simplify-js';
import type { ImageData, Point, ContourHierarchy } from '@shared/types';

export interface Contour {
  points: Point[];
  holes: Point[][];
  isHole: boolean;
  parent: number;
}

/**
 * Extract contours from binary image using Moore neighborhood tracing
 * Returns hierarchical contours with proper hole detection
 */
export function extractContours(imageData: ImageData): Contour[] {
  const { width, height, data } = imageData;
  const visited = new Array(width * height).fill(false);
  const contours: Contour[] = [];
  const hierarchy: ContourHierarchy[] = [];
  
  // Scan image for contour starting points
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const pixelIndex = index * 4;
      
      if (visited[index]) continue;
      
      const isBlack = data[pixelIndex] === 0; // Foreground pixel
      
      // Check if this is a contour starting point
      if (isBlack && isContourStart(imageData, x, y)) {
        const contour = traceContour(imageData, x, y, visited);
        if (contour.points.length > 3) { // Minimum viable contour
          contours.push({
            points: contour.points,
            holes: [],
            isHole: false,
            parent: -1,
          });
        }
      }
    }
  }
  
  // Find holes and establish hierarchy
  const contoursWithHoles = findHoles(imageData, contours);
  
  console.log(`Extracted ${contoursWithHoles.length} contours`);
  return contoursWithHoles;
}

/**
 * Simplify contours using Douglas-Peucker algorithm
 * Reduces point count while preserving shape fidelity
 */
export function simplifyContours(contours: Contour[], epsilon: number): Contour[] {
  return contours.map(contour => ({
    ...contour,
    points: simplifyPoints(contour.points, epsilon),
    holes: contour.holes.map(hole => simplifyPoints(hole, epsilon)),
  }));
}

/**
 * Check if a pixel is a contour starting point
 * Must be foreground with at least one background neighbor
 */
function isContourStart(imageData: ImageData, x: number, y: number): boolean {
  const { width, height, data } = imageData;
  
  // Check 8-connected neighbors
  const neighbors = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];
  
  for (const [dx, dy] of neighbors) {
    const nx = x + dx;
    const ny = y + dy;
    
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
      return true; // Border is considered background
    }
    
    const neighborIndex = (ny * width + nx) * 4;
    if (data[neighborIndex] === 255) { // Background neighbor found
      return true;
    }
  }
  
  return false;
}

/**
 * Trace contour using Moore neighborhood algorithm
 * Follows the boundary of a connected component
 */
function traceContour(imageData: ImageData, startX: number, startY: number, visited: boolean[]): { points: Point[] } {
  const { width, height, data } = imageData;
  const points: Point[] = [];
  
  // Moore neighborhood directions (8-connected)
  const directions = [
    [0, -1],  // North
    [1, -1],  // Northeast
    [1, 0],   // East
    [1, 1],   // Southeast
    [0, 1],   // South
    [-1, 1],  // Southwest
    [-1, 0],  // West
    [-1, -1]  // Northwest
  ];
  
  let currentX = startX;
  let currentY = startY;
  let direction = 0; // Start facing north
  
  do {
    points.push({ x: currentX, y: currentY });
    visited[currentY * width + currentX] = true;
    
    // Find next boundary pixel
    let found = false;
    for (let i = 0; i < 8; i++) {
      const checkDir = (direction + i) % 8;
      const [dx, dy] = directions[checkDir];
      const nextX = currentX + dx;
      const nextY = currentY + dy;
      
      if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) {
        const nextIndex = (nextY * width + nextX) * 4;
        
        if (data[nextIndex] === 0) { // Foreground pixel
          currentX = nextX;
          currentY = nextY;
          direction = (checkDir + 6) % 8; // Turn left for next iteration
          found = true;
          break;
        }
      }
    }
    
    if (!found) break;
    
  } while (currentX !== startX || currentY !== startY || points.length < 3);
  
  return { points };
}

/**
 * Find holes within contours and establish parent-child relationships
 */
function findHoles(imageData: ImageData, contours: Contour[]): Contour[] {
  const { width, height, data } = imageData;
  const result: Contour[] = [...contours];
  
  // Find hole contours (white pixels surrounded by black)
  const visited = new Array(width * height).fill(false);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      const pixelIndex = index * 4;
      
      if (visited[index] || data[pixelIndex] !== 255) continue; // Not white or already visited
      
      // Check if this white pixel is surrounded by black (potential hole)
      if (isHoleStart(imageData, x, y)) {
        const holeContour = traceContour(imageData, x, y, visited);
        if (holeContour.points.length > 3) {
          // Find parent contour that contains this hole
          const parentIndex = findContainingContour(result, holeContour.points[0]);
          if (parentIndex >= 0) {
            result[parentIndex].holes.push(holeContour.points);
          }
        }
      }
    }
  }
  
  return result;
}

/**
 * Check if a white pixel is the start of a hole
 */
function isHoleStart(imageData: ImageData, x: number, y: number): boolean {
  const { width, height, data } = imageData;
  
  // Check if surrounded by black pixels
  const neighbors = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];
  
  let blackNeighbors = 0;
  for (const [dx, dy] of neighbors) {
    const nx = x + dx;
    const ny = y + dy;
    
    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
      const neighborIndex = (ny * width + nx) * 4;
      if (data[neighborIndex] === 0) { // Black neighbor
        blackNeighbors++;
      }
    }
  }
  
  return blackNeighbors >= 6; // Mostly surrounded by black
}

/**
 * Find which contour contains a given point using ray casting
 */
function findContainingContour(contours: Contour[], point: Point): number {
  for (let i = 0; i < contours.length; i++) {
    if (pointInPolygon(point, contours[i].points)) {
      return i;
    }
  }
  return -1;
}

/**
 * Point-in-polygon test using ray casting algorithm
 */
function pointInPolygon(point: Point, polygon: Point[]): boolean {
  const { x, y } = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

/**
 * Simplify point array using Douglas-Peucker algorithm
 */
function simplifyPoints(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points;
  
  // Convert to format expected by simplify-js
  const simplifyPoints = points.map(p => ({ x: p.x, y: p.y }));
  const simplified = simplify(simplifyPoints, epsilon, true); // High quality
  
  // Convert back to our Point format
  return simplified.map(p => ({ x: p.x, y: p.y }));
}

/**
 * Calculate polygon area (for validation)
 */
export function calculatePolygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  
  return Math.abs(area) / 2;
}

/**
 * Ensure polygon has consistent winding order (counter-clockwise for exterior)
 */
export function ensureWindingOrder(points: Point[], clockwise: boolean = false): Point[] {
  if (points.length < 3) return points;
  
  // Calculate signed area to determine current winding
  let signedArea = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    signedArea += (points[j].x - points[i].x) * (points[j].y + points[i].y);
  }
  
  const isClockwise = signedArea > 0;
  
  // Reverse if winding doesn't match desired order
  if (isClockwise !== clockwise) {
    return [...points].reverse();
  }
  
  return points;
}