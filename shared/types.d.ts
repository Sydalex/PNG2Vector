/**
 * Shared TypeScript types for PNG to SVG/DXF conversion API
 */
export interface TraceRequest {
    /** Fidelity level 0-100 (higher = more detail) */
    fidelity: number;
    /** Whether to include white fill in output */
    whiteFill: boolean;
    /** Optional threshold for binarization (0-255) */
    threshold?: number;
    /** Minimum area for speckle removal (px²) */
    despeckleAreaMin?: number;
    /** Whether to use AI preprocessing */
    useAI?: boolean;
}
export interface TraceResponse {
    /** Generated SVG content */
    svg: string;
    /** Generated DXF content (base64 encoded) */
    dxf: string;
    /** Processing metrics */
    metrics: TraceMetrics;
}
export interface TraceMetrics {
    /** Total number of vector nodes */
    nodeCount: number;
    /** Number of polygons extracted */
    polygonCount: number;
    /** Simplification ratio applied */
    simplification: number;
    /** Processing time breakdown */
    timings: {
        preprocessing?: number;
        aiProcessing?: number;
        vectorization: number;
        export: number;
        total: number;
    };
}
export interface Point {
    x: number;
    y: number;
}
export interface Polygon {
    /** Outer boundary points */
    exterior: Point[];
    /** Interior holes */
    holes: Point[][];
}
export interface ProcessingOptions {
    /** Simplification epsilon (px) */
    epsilon: number;
    /** Minimum area threshold (px²) */
    areaMin: number;
    /** Binary threshold (0-255) */
    threshold: number;
    /** Use AI preprocessing */
    useAI: boolean;
}
export interface ImageData {
    /** Image width in pixels */
    width: number;
    /** Image height in pixels */
    height: number;
    /** RGBA pixel data */
    data: Uint8Array;
}
export interface ContourHierarchy {
    /** Contour index */
    index: number;
    /** Parent contour index (-1 if root) */
    parent: number;
    /** Child contour indices */
    children: number[];
    /** Whether this is a hole */
    isHole: boolean;
}
export interface ErrorResponse {
    error: string;
    details?: string;
    code?: string;
}
//# sourceMappingURL=types.d.ts.map