// filename: apps/server/src/trace/geometry.ts
import * as martinez from 'martinez-polygon-clipping';
import type { Point, Polygon } from '@shared/types';

/**
 * Geometry validation and cleanup utilities
 * Ensures CAD-safe output with proper topology
 */

/**
 * Validate and clean up polygon geometry
 * Removes self-intersections, ensures proper winding, and validates topology
 */
export function validateGeometry(polygons: Polygon[]): Polygon[] {
  const validPolygons: Polygon[] = [];
  
  for (const polygon of polygons) {
    try {
      // Skip degenerate polygons
      if (polygon.exterior.length < 3) {
        continue;
      }
      
      // Ensure closed rings
      const closedExterior = ensureClosedRing(polygon.exterior);
      const closedHoles = polygon.holes.map(hole => ensureClosedRing(hole));
      
      // Remove duplicate consecutive points
      const cleanExterior = removeDuplicatePoints(closedExterior);
      const cleanHoles = closedHoles.map(hole => removeDuplicatePoints(hole));
      
      // Skip if exterior became too small
      if (cleanExterior.length < 3) {
        continue;
      }
      
      // Ensure proper winding order (CCW for exterior, CW for holes)
      const orientedExterior = ensureCounterClockwise(cleanExterior);
      const orientedHoles = cleanHoles
        .filter(hole => hole.length >= 3)
        .map(hole => ensureClockwise(hole));
      
      // Fix self-intersections using polygon clipping
      const fixedPolygon = fixSelfIntersections({
        exterior: orientedExterior,
        holes: orientedHoles,
      });
      
      if (fixedPolygon) {
        validPolygons.push(fixedPolygon);
      }
      
    } catch (error) {
      console.warn('Failed to validate polygon:', error);
      // Skip invalid polygon
    }
  }
  
  console.log(`Validated ${validPolygons.length}/${polygons.length} polygons`);
  return validPolygons;
}

/**
 * Clean up geometry by removing small artifacts and merging nearby points
 */
export function cleanupGeometry(polygons: Polygon[], minArea: number): Polygon[] {
  return polygons
    .filter(polygon => calculatePolygonArea(polygon.exterior) >= minArea)
    .map(polygon => ({
      exterior: snapToGrid(polygon.exterior, 0.001), // Snap to 0.001 unit grid
      holes: polygon.holes
        .filter(hole => calculatePolygonArea(hole) >= minArea * 0.1) // Smaller threshold for holes
        .map(hole => snapToGrid(hole, 0.001)),
    }))
    .filter(polygon => polygon.exterior.length >= 3);
}

/**
 * Ensure ring is closed (first point equals last point)
 */
function ensureClosedRing(points: Point[]): Point[] {
  if (points.length < 3) return points;
  
  const first = points[0];
  const last = points[points.length - 1];
  
  // Check if already closed (within tolerance)
  const tolerance = 0.001;
  if (Math.abs(first.x - last.x) < tolerance && Math.abs(first.y - last.y) < tolerance) {
    return points;
  }
  
  // Close the ring
  return [...points, { x: first.x, y: first.y }];
}

/**
 * Remove duplicate consecutive points
 */
function removeDuplicatePoints(points: Point[], tolerance: number = 0.001): Point[] {
  if (points.length <= 1) return points;
  
  const cleaned: Point[] = [points[0]];
  
  for (let i = 1; i < points.length; i++) {
    const current = points[i];
    const previous = cleaned[cleaned.length - 1];
    
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance >= tolerance) {
      cleaned.push(current);
    }
  }
  
  return cleaned;
}

/**
 * Ensure counter-clockwise winding order
 */
function ensureCounterClockwise(points: Point[]): Point[] {
  if (points.length < 3) return points;
  
  const signedArea = calculateSignedArea(points);
  
  // If clockwise (positive area), reverse
  if (signedArea > 0) {
    return [...points].reverse();
  }
  
  return points;
}

/**
 * Ensure clockwise winding order
 */
function ensureClockwise(points: Point[]): Point[] {
  if (points.length < 3) return points;
  
  const signedArea = calculateSignedArea(points);
  
  // If counter-clockwise (negative area), reverse
  if (signedArea < 0) {
    return [...points].reverse();
  }
  
  return points;
}

/**
 * Calculate signed area of polygon (positive = clockwise, negative = counter-clockwise)
 */
function calculateSignedArea(points: Point[]): number {
  if (points.length < 3) return 0;
  
  let area = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    area += (next.x - current.x) * (next.y + current.y);
  }
  
  return area / 2;
}

/**
 * Calculate polygon area (always positive)
 */
function calculatePolygonArea(points: Point[]): number {
  return Math.abs(calculateSignedArea(points));
}

/**
 * Fix self-intersections using Martinez polygon clipping
 */
function fixSelfIntersections(polygon: Polygon): Polygon | null {
  try {
    // Convert to Martinez format: [[[x, y], [x, y], ...]]
    const exteriorCoords = polygon.exterior.map(p => [p.x, p.y]);
    const holeCoords = polygon.holes.map(hole => hole.map(p => [p.x, p.y]));
    
    // Create polygon in Martinez format
    const martinezPolygon: martinez.Polygon = [exteriorCoords, ...holeCoords];
    
    // Use union operation with empty polygon to fix self-intersections
    const fixed = martinez.union([martinezPolygon], []);
    
    if (!fixed || fixed.length === 0) {
      return null;
    }
    
    // Take the first (largest) result polygon
    const firstPolygon = fixed[0];
    if (!firstPolygon || firstPolygon.length === 0) {
      return null;
    }
    
    // Convert back to our format
    const fixedExterior = firstPolygon[0].map(([x, y]: [number, number]) => ({ x, y }));
    const fixedHoles = firstPolygon.slice(1).map((hole: any) => 
      hole.map(([x, y]: [number, number]) => ({ x, y }))
    );
    
    return {
      exterior: fixedExterior,
      holes: fixedHoles,
    };
    
  } catch (error) {
    console.warn('Failed to fix self-intersections:', error);
    return polygon; // Return original if fixing fails
  }
}

/**
 * Snap points to grid to reduce floating point precision issues
 */
function snapToGrid(points: Point[], gridSize: number): Point[] {
  return points.map(point => ({
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  }));
}

/**
 * Check if polygon is valid (no self-intersections, proper winding)
 */
export function isValidPolygon(polygon: Polygon): boolean {
  try {
    // Check minimum point count
    if (polygon.exterior.length < 3) {
      return false;
    }
    
    // Check for holes with insufficient points
    for (const hole of polygon.holes) {
      if (hole.length < 3) {
        return false;
      }
    }
    
    // Check area (must be positive)
    const area = calculatePolygonArea(polygon.exterior);
    if (area <= 0) {
      return false;
    }
    
    // Check for self-intersections (basic check)
    if (hasSelfIntersections(polygon.exterior)) {
      return false;
    }
    
    return true;
    
  } catch (error) {
    return false;
  }
}

/**
 * Basic self-intersection check using line segment intersection
 */
function hasSelfIntersections(points: Point[]): boolean {
  if (points.length < 4) return false;
  
  // Check each edge against all non-adjacent edges
  for (let i = 0; i < points.length - 1; i++) {
    const edge1 = [points[i], points[i + 1]];
    
    for (let j = i + 2; j < points.length - 1; j++) {
      // Skip adjacent edges and last-to-first edge
      if (j === points.length - 2 && i === 0) continue;
      
      const edge2 = [points[j], points[j + 1]];
      
      if (lineSegmentsIntersect(edge1[0], edge1[1], edge2[0], edge2[1])) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Check if two line segments intersect
 */
function lineSegmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);
  
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  
  // Check for collinear points
  if (d1 === 0 && onSegment(p3, p1, p4)) return true;
  if (d2 === 0 && onSegment(p3, p2, p4)) return true;
  if (d3 === 0 && onSegment(p1, p3, p2)) return true;
  if (d4 === 0 && onSegment(p1, p4, p2)) return true;
  
  return false;
}

/**
 * Calculate direction of three points (cross product)
 */
function direction(a: Point, b: Point, c: Point): number {
  return (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
}

/**
 * Check if point q lies on line segment pr
 */
function onSegment(p: Point, q: Point, r: Point): boolean {
  return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
         q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}