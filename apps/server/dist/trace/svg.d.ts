import type { Polygon } from '../../../../shared/types';
/**
 * Generate SVG output with VectorWorks-compatible classes
 * Uses fill-rule="evenodd" for proper hole handling
 */
export declare function generateSVG(polygons: Polygon[], width: number, height: number, whiteFill?: boolean): string;
/**
 * Generate optimized SVG for CAD applications
 * Includes metadata and proper scaling information
 */
export declare function generateOptimizedSVG(polygons: Polygon[], width: number, height: number, whiteFill?: boolean, options?: {
    title?: string;
    description?: string;
    units?: string;
    scale?: number;
}): string;
/**
 * Generate SVG with custom styling
 */
export declare function generateStyledSVG(polygons: Polygon[], width: number, height: number, style?: {
    strokeColor?: string;
    strokeWidth?: number;
    fillColor?: string;
    backgroundColor?: string;
}): string;
//# sourceMappingURL=svg.d.ts.map