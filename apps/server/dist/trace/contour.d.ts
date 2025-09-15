import type { ImageData, Point } from '../../../../shared/types';
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
export declare function extractContours(imageData: ImageData): Contour[];
/**
 * Simplify contours using Douglas-Peucker algorithm
 * Reduces point count while preserving shape fidelity
 */
export declare function simplifyContours(contours: Contour[], epsilon: number): Contour[];
/**
 * Calculate polygon area (for validation)
 */
export declare function calculatePolygonArea(points: Point[]): number;
/**
 * Ensure polygon has consistent winding order (counter-clockwise for exterior)
 */
export declare function ensureWindingOrder(points: Point[], clockwise?: boolean): Point[];
//# sourceMappingURL=contour.d.ts.map