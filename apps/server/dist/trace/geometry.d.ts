import type { Point, Polygon } from '../../../../shared/types';
/**
 * Geometry validation and cleanup utilities
 * Ensures CAD-safe output with proper topology
 */
/**
 * Validate and clean up polygon geometry
 * Removes self-intersections, ensures proper winding, and validates topology
 */
export declare function validateGeometry(polygons: Polygon[]): Polygon[];
/**
 * Clean up geometry by removing small artifacts and merging nearby points
 */
export declare function cleanupGeometry(polygons: Polygon[], minArea: number): Polygon[];
/**
 * Calculate signed area of polygon (positive = clockwise, negative = counter-clockwise)
 */
export declare function calculateSignedArea(points: Point[]): number;
/**
 * Check if polygon is valid (no self-intersections, proper winding)
 */
export declare function isValidPolygon(polygon: Polygon): boolean;
//# sourceMappingURL=geometry.d.ts.map