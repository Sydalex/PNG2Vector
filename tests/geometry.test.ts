import { validateGeometry, cleanupGeometry, isValidPolygon } from '../apps/server/src/trace/geometry';
import type { Polygon, Point } from '../shared/types';

describe('Geometry Validation', () => {
  const createSquare = (size: number = 10): Point[] => [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
    { x: 0, y:0 }, // Closed
  ];

  const createTriangle = (): Point[] => [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 5, y: 10 },
    { x: 0, y: 0 }, // Closed
  ];

  describe('validateGeometry', () => {
    it('should validate simple polygons', () => {
      const polygons: Polygon[] = [
        { exterior: createSquare(), holes: [] },
        { exterior: createTriangle(), holes: [] },
      ];

      const result = validateGeometry(polygons);
      expect(result).toHaveLength(2);
      expect(result[0].exterior).toHaveLength(5); // Square with closure
      expect(result[1].exterior).toHaveLength(4); // Triangle with closure
    });

    it('should remove degenerate polygons', () => {
      const polygons: Polygon[] = [
        { exterior: createSquare(), holes: [] },
        { exterior: [{ x: 0, y: 0 }, { x: 1, y: 1 }], holes: [] }, // Too few points
        { exterior: [], holes: [] }, // Empty
      ];

      const result = validateGeometry(polygons);
      expect(result).toHaveLength(1);
      expect(result[0].exterior).toEqual(createSquare());
    });

    it('should handle polygons with holes', () => {
      const exterior = createSquare(20);
      const hole = createSquare(5).map(p => ({ x: p.x + 7.5, y: p.y + 7.5 }));
      
      const polygons: Polygon[] = [
        { exterior, holes: [hole] },
      ];

      const result = validateGeometry(polygons);
      expect(result).toHaveLength(1);
      expect(result[0].holes).toHaveLength(1);
    });

    it('should ensure proper winding order', () => {
      // Clockwise exterior (should be reversed to CCW)
      const clockwiseSquare = [
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: 10, y: 10 },
        { x: 10, y: 0 },
        { x: 0, y: 0 },
      ];

      const polygons: Polygon[] = [
        { exterior: clockwiseSquare, holes: [] },
      ];

      const result = validateGeometry(polygons);
      expect(result).toHaveLength(1);
      
      // Should be counter-clockwise now
      const signedArea = calculateSignedArea(result[0].exterior);
      expect(signedArea).toBeLessThan(0); // CCW has negative signed area
    });
  });

  describe('cleanupGeometry', () => {
    it('should remove small polygons', () => {
      const polygons: Polygon[] = [
        { exterior: createSquare(10), holes: [] }, // Area = 100
        { exterior: createSquare(1), holes: [] },  // Area = 1
      ];

      const result = cleanupGeometry(polygons, 50); // Min area = 50
      expect(result).toHaveLength(1);
      expect(result[0].exterior).toEqual(createSquare(10));
    });

    it('should snap points to grid', () => {
      const polygons: Polygon[] = [
        {
          exterior: [
            { x: 0.0001, y: 0.0002 },
            { x: 9.9999, y: 0.0001 },
            { x: 10.0001, y: 9.9998 },
            { x: 0.0002, y: 10.0001 },
            { x: 0.0001, y: 0.0002 },
          ],
          holes: [],
        },
      ];

      const result = cleanupGeometry(polygons, 1);
      
      // Points should be snapped to 0.001 grid
      expect(result[0].exterior[0]).toEqual({ x: 0, y: 0 });
      expect(result[0].exterior[1]).toEqual({ x: 10, y: 0 });
    });

    it('should remove small holes', () => {
      const exterior = createSquare(20);
      const largeHole = createSquare(5).map(p => ({ x: p.x + 2, y: p.y + 2 })); // Area = 25
      const smallHole = createSquare(1).map(p => ({ x: p.x + 15, y: p.y + 15 })); // Area = 1

      const polygons: Polygon[] = [
        { exterior, holes: [largeHole, smallHole] },
      ];

      const result = cleanupGeometry(polygons, 100); // Min area = 100, hole threshold = 10
      expect(result).toHaveLength(1);
      expect(result[0].holes).toHaveLength(1); // Only large hole should remain
    });
  });

  describe('isValidPolygon', () => {
    it('should validate correct polygons', () => {
      const validPolygon: Polygon = {
        exterior: createSquare(),
        holes: [],
      };

      expect(isValidPolygon(validPolygon)).toBe(true);
    });

    it('should reject polygons with too few points', () => {
      const invalidPolygon: Polygon = {
        exterior: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        holes: [],
      };

      expect(isValidPolygon(invalidPolygon)).toBe(false);
    });

    it('should reject polygons with invalid holes', () => {
      const invalidPolygon: Polygon = {
        exterior: createSquare(),
        holes: [[{ x: 0, y: 0 }, { x: 1, y: 1 }]], // Hole with too few points
      };

      expect(isValidPolygon(invalidPolygon)).toBe(false);
    });
  });

  describe('Even-odd parity', () => {
    it('should maintain proper hole relationships', () => {
      const exterior = createSquare(20);
      const hole1 = createSquare(4).map(p => ({ x: p.x + 2, y: p.y + 2 }));
      const hole2 = createSquare(4).map(p => ({ x: p.x + 12, y: p.y + 12 }));

      const polygons: Polygon[] = [
        { exterior, holes: [hole1, hole2] },
      ];

      const result = validateGeometry(polygons);
      expect(result).toHaveLength(1);
      expect(result[0].holes).toHaveLength(2);

      // Holes should have clockwise winding (opposite of exterior)
      for (const hole of result[0].holes) {
        const signedArea = calculateSignedArea(hole);
        expect(signedArea).toBeGreaterThan(0); // CW has positive signed area
      }
    });
  });

  describe('Duplicate point removal', () => {
    it('should remove consecutive duplicate points', () => {
      const polygonWithDuplicates: Polygon = {
        exterior: [
          { x: 0, y: 0 },
          { x: 0, y: 0 }, // Duplicate
          { x: 10, y: 0 },
          { x: 10, y: 0 }, // Duplicate
          { x: 10, y: 10 },
          { x: 0, y: 10 },
          { x: 0, y: 0 },
        ],
        holes: [],
      };

      const result = validateGeometry([polygonWithDuplicates]);
      expect(result).toHaveLength(1);
      
      // Should have removed duplicates but kept valid points
      expect(result[0].exterior.length).toBeLessThan(polygonWithDuplicates.exterior.length);
      expect(result[0].exterior.length).toBeGreaterThanOrEqual(4); // At least triangle + closure
    });
  });
});

// Helper function to calculate signed area
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