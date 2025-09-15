"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateGeometry = validateGeometry;
exports.cleanupGeometry = cleanupGeometry;
exports.calculateSignedArea = calculateSignedArea;
exports.isValidPolygon = isValidPolygon;
// filename: apps/server/src/trace/geometry.ts
const martinez = __importStar(require("martinez-polygon-clipping"));
/**
 * Geometry validation and cleanup utilities
 * Ensures CAD-safe output with proper topology
 */
/**
 * Validate and clean up polygon geometry
 * Removes self-intersections, ensures proper winding, and validates topology
 */
function validateGeometry(polygons) {
    const validPolygons = [];
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
        }
        catch (error) {
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
function cleanupGeometry(polygons, minArea) {
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
function ensureClosedRing(points) {
    if (points.length < 3)
        return points;
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
function removeDuplicatePoints(points, tolerance = 0.001) {
    if (points.length <= 1)
        return points;
    const cleaned = [points[0]];
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
function ensureCounterClockwise(points) {
    if (points.length < 3)
        return points;
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
function ensureClockwise(points) {
    if (points.length < 3)
        return points;
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
function calculateSignedArea(points) {
    if (points.length < 3)
        return 0;
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
function calculatePolygonArea(points) {
    return Math.abs(calculateSignedArea(points));
}
/**
 * Fix self-intersections using Martinez polygon clipping
 */
function fixSelfIntersections(polygon) {
    try {
        // Convert to Martinez format: [[[x, y], [x, y], ...]]
        const exteriorCoords = polygon.exterior.map(p => [p.x, p.y]);
        const holeCoords = polygon.holes.map(hole => hole.map(p => [p.x, p.y]));
        // Create polygon in Martinez format
        const martinezPolygon = [exteriorCoords, ...holeCoords];
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
        // Convert back to our format with complete type safety
        const rawExterior = firstPolygon[0];
        const rawHoles = firstPolygon.slice(1);
        const fixedExterior = Array.isArray(rawExterior) ? rawExterior.map((coord) => ({
            x: typeof coord[0] === 'number' ? coord[0] : 0,
            y: typeof coord[1] === 'number' ? coord[1] : 0
        })) : [];
        const fixedHoles = Array.isArray(rawHoles) ? rawHoles.map((hole) => {
            if (!Array.isArray(hole))
                return [];
            return hole.map((coord) => ({
                x: typeof coord[0] === 'number' ? coord[0] : 0,
                y: typeof coord[1] === 'number' ? coord[1] : 0
            }));
        }) : [];
        return {
            exterior: fixedExterior,
            holes: fixedHoles,
        };
    }
    catch (error) {
        console.warn('Failed to fix self-intersections:', error);
        return polygon; // Return original if fixing fails
    }
}
/**
 * Snap points to grid to reduce floating point precision issues
 */
function snapToGrid(points, gridSize) {
    return points.map(point => ({
        x: Math.round(point.x / gridSize) * gridSize,
        y: Math.round(point.y / gridSize) * gridSize,
    }));
}
/**
 * Check if polygon is valid (no self-intersections, proper winding)
 */
function isValidPolygon(polygon) {
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
    }
    catch (error) {
        return false;
    }
}
/**
 * Basic self-intersection check using line segment intersection
 */
function hasSelfIntersections(points) {
    if (points.length < 4)
        return false;
    // Check each edge against all non-adjacent edges
    for (let i = 0; i < points.length - 1; i++) {
        const edge1 = [points[i], points[i + 1]];
        for (let j = i + 2; j < points.length - 1; j++) {
            // Skip adjacent edges and last-to-first edge
            if (j === points.length - 2 && i === 0)
                continue;
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
function lineSegmentsIntersect(p1, p2, p3, p4) {
    const d1 = direction(p3, p4, p1);
    const d2 = direction(p3, p4, p2);
    const d3 = direction(p1, p2, p3);
    const d4 = direction(p1, p2, p4);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
        return true;
    }
    // Check for collinear points
    if (d1 === 0 && onSegment(p3, p1, p4))
        return true;
    if (d2 === 0 && onSegment(p3, p2, p4))
        return true;
    if (d3 === 0 && onSegment(p1, p3, p2))
        return true;
    if (d4 === 0 && onSegment(p1, p4, p2))
        return true;
    return false;
}
/**
 * Calculate direction of three points (cross product)
 */
function direction(a, b, c) {
    return (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
}
/**
 * Check if point q lies on line segment pr
 */
function onSegment(p, q, r) {
    return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
        q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
}
//# sourceMappingURL=geometry.js.map