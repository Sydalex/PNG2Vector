import type { Polygon } from '../../../../shared/types';
/**
 * Generate DXF output with closed LWPOLYLINE entities
 * Ensures CAD-compatible format with proper layer structure
 */
export declare function generateDXF(polygons: Polygon[], width: number, height: number, whiteFill?: boolean): string;
/**
 * Generate minimal DXF with only essential elements
 */
export declare function generateMinimalDXF(polygons: Polygon[], whiteFill?: boolean): string;
/**
 * Validate DXF output for CAD compatibility
 */
export declare function validateDXFOutput(dxfContent: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
};
//# sourceMappingURL=dxf.d.ts.map