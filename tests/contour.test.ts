import { extractContours, simplifyContours, calculatePolygonArea, ensureWindingOrder } from '../apps/server/src/trace/contour';
import type { ImageData, Point } from '../shared/types';

describe('Contour Extraction', () => {
  // Helper to create binary image data
  const createBinaryImage = (width: number, height: number, pattern: number[][]): ImageData => {
    const data = new Uint8Array(width * height * 4);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const value = pattern[y] && pattern[y][x] ? 0 : 255; // 0 = black (foreground), 255 = white (background)
        
        data[index] = value;     // R
        data[index + 1] = value; // G
        data[index + 2] = value; // B
        data[index + 3] = 255;   // A
      }
    }
    
    return { width, height, data };
  };

  describe('extractContours', () => {
    it('should extract simple rectangle contour', () => {
      // Create a 5x5 image with a 3x3 black rectangle in the center
      const pattern = [
        [0, 0, 0, 0, 0],
        [0, 1, 1, 1, 0],
        [0, 1, 1, 1, 0],
        [0, 1, 1, 1, 0],
        [0, 0, 0, 0, 0],
      ];
      
      const imageData = createBinaryImage(5, 5, pattern);
      const contours = extractContours(imageData);
      
      expect(contours.length).toBeGreaterThan(0);
      expect(contours[0].points.length).toBeGreaterThanOrEqual(4); // At least 4 points for rectangle
      expect(contours[0].holes).toEqual([]);
    });

    it('should extract contour with hole', () => {
      // Create a 7x7 image with outer rectangle and inner hole
      const pattern = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 1, 1, 0],
        [0, 1, 1, 1, 1, 1, 0],
        [0, 1, 1, 0, 1, 1, 0], // Hole in center
        [0, 1, 1, 1, 1, 1, 0],
        [0, 1, 1, 1, 1, 1, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ];
      
      const imageData = createBinaryImage(7, 7, pattern);
      const contours = extractContours(imageData);
      
      expect(contours.length).toBeGreaterThan(0);
      
      // Should find contour with hole
      const contourWithHole = contours.find(c => c.holes.length > 0);
      expect(contourWithHole).toBeDefined();
      if (contourWithHole) {
        expect(contourWithHole.holes.length).toBe(1);
        expect(contourWithHole.holes[0].length).toBeGreaterThanOrEqual(3);
      }
    });

    it('should extract multiple separate contours', () => {
      // Create image with two separate rectangles
      const pattern = [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 0, 1, 1, 0],
        [0, 1, 1, 0, 1, 1, 0],
        [0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 0, 1, 1, 0],
        [0, 1, 1, 0, 1, 1, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ];
      
      const imageData = createBinaryImage(7, 7, pattern);
      const contours = extractContours(imageData);
      
      expect(contours.length).toBeGreaterThanOrEqual(2); // Should find at least 2 separate contours
    });

    it('should handle empty image', () => {
      // All white image (no foreground)
      const pattern = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];
      
      const imageData = createBinaryImage(3, 3, pattern);
      const contours = extractContours(imageData);
      
      expect(contours).toEqual([]);
    });

    it('should handle single pixel', () => {
      // Single black pixel
      const pattern = [
        [0, 0, 0],
        [0, 1, 0],
        [0, 0, 0],
      ];
      
      const imageData = createBinaryImage(3, 3, pattern);
      const contours = extractContours(imageData);
      
      // Single pixel might not generate a valid contour (needs at least 3 points)
      // This tests edge case handling
      expect(Array.isArray(contours)).toBe(true);
    });
  });

  describe('simplifyContours', () => {
    it('should simplify contour points', () => {
      // Create a contour with many collinear points
      const contour = {
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
          { x: 3, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 4 },
          { x: 0, y: 4 },
          { x: 0, y: 0 },
        ],
        holes: [],
        isHole: false,
        parent: -1,
      };

      const simplified = simplifyContours([contour], 0.5);
      
      expect(simplified).toHaveLength(1);
      expect(simplified[0].points.length).toBeLessThan(contour.points.length);
      expect(simplified[0].points.length).toBeGreaterThanOrEqual(4); // Should keep essential points
    });

    it('should simplify holes as well', () => {
      const contour = {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
          { x: 0, y: 0 },
        ],
        holes: [[
          { x: 2, y: 2 },
          { x: 3, y: 2 },
          { x: 4, y: 2 },
          { x: 5, y: 2 },
          { x: 5, y: 5 },
          { x: 2, y: 5 },
          { x: 2, y: 2 },
        ]],
        isHole: false,
        parent: -1,
      };

      const simplified = simplifyContours([contour], 0.5);
      
      expect(simplified).toHaveLength(1);
      expect(simplified[0].holes).toHaveLength(1);
      expect(simplified[0].holes[0].length).toBeLessThan(contour.holes[0].length);
    });

    it('should preserve shape with low epsilon', () => {
      const contour = {
        points: [
          { x: 0, y: 0 },
          { x: 5, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
          { x: 0, y: 0 },
        ],
        holes: [],
        isHole: false,
        parent: -1,
      };

      const simplified = simplifyContours([contour], 0.1); // Very low epsilon
      
      expect(simplified).toHaveLength(1);
      // With low epsilon, should preserve most points
      expect(simplified[0].points.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('calculatePolygonArea', () => {
    it('should calculate area of square', () => {
      const square: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      const area = calculatePolygonArea(square);
      expect(area).toBe(100);
    });

    it('should calculate area of triangle', () => {
      const triangle: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ];

      const area = calculatePolygonArea(triangle);
      expect(area).toBe(50); // Base * Height / 2 = 10 * 10 / 2
    });

    it('should return 0 for degenerate polygon', () => {
      const line: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ];

      const area = calculatePolygonArea(line);
      expect(area).toBe(0);
    });
  });

  describe('ensureWindingOrder', () => {
    it('should maintain counter-clockwise order', () => {
      const ccwSquare: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];

      const result = ensureWindingOrder(ccwSquare, false); // Want CCW
      expect(result).toEqual(ccwSquare); // Should remain unchanged
    });

    it('should reverse clockwise to counter-clockwise', () => {
      const cwSquare: Point[] = [
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: 10, y: 10 },
        { x: 10, y: 0 },
      ];

      const result = ensureWindingOrder(cwSquare, false); // Want CCW
      expect(result).not.toEqual(cwSquare); // Should be reversed
      expect(result[0]).toEqual(cwSquare[0]); // First point same
      expect(result[1]).toEqual(cwSquare[cwSquare.length - 1]); // Second point is last of original
    });

    it('should maintain clockwise order when requested', () => {
      const cwSquare: Point[] = [
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: 10, y: 10 },
        { x: 10, y: 0 },
      ];

      const result = ensureWindingOrder(cwSquare, true); // Want CW
      expect(result).toEqual(cwSquare); // Should remain unchanged
    });

    it('should handle degenerate cases', () => {
      const line: Point[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ];

      const result = ensureWindingOrder(line, false);
      expect(result).toEqual(line); // Should handle gracefully
    });
  });

  describe('Contour validation', () => {
    it('should filter out contours with too few points', () => {
      // Create image that might generate very small contours
      const pattern = [
        [0, 0, 0, 0, 0],
        [0, 1, 0, 1, 0],
        [0, 0, 0, 0, 0],
        [0, 1, 0, 1, 0],
        [0, 0, 0, 0, 0],
      ];
      
      const imageData = createBinaryImage(5, 5, pattern);
      const contours = extractContours(imageData);
      
      // All returned contours should have at least 4 points (minimum for valid contour)
      for (const contour of contours) {
        expect(contour.points.length).toBeGreaterThan(3);
      }
    });

    it('should maintain contour closure', () => {
      const pattern = [
        [0, 0, 0, 0, 0],
        [0, 1, 1, 1, 0],
        [0, 1, 0, 1, 0],
        [0, 1, 1, 1, 0],
        [0, 0, 0, 0, 0],
      ];
      
      const imageData = createBinaryImage(5, 5, pattern);
      const contours = extractContours(imageData);
      
      // Each contour should be closed (first point equals last point, within tolerance)
      for (const contour of contours) {
        if (contour.points.length > 0) {
          const first = contour.points[0];
          const last = contour.points[contour.points.length - 1];
          const distance = Math.sqrt(
            Math.pow(first.x - last.x, 2) + Math.pow(first.y - last.y, 2)
          );
          expect(distance).toBeLessThan(1.5); // Should be very close (allowing for pixel precision)
        }
      }
    });
  });
});