// filename: tests/dxf.test.ts
import { generateDXF, generateMinimalDXF, validateDXFOutput } from '../apps/server/src/trace/dxf';
import type { Polygon } from '../shared/types';

describe('DXF Generation', () => {
  const createTestPolygons = (): Polygon[] => [
    {
      exterior: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 0, y: 0 },
      ],
      holes: [],
    },
    {
      exterior: [
        { x: 20, y: 20 },
        { x: 30, y: 20 },
        { x: 30, y: 30 },
        { x: 20, y: 30 },
        { x: 20, y: 20 },
      ],
      holes: [
        [
          { x: 22, y: 22 },
          { x: 28, y: 22 },
          { x: 28, y: 28 },
          { x: 22, y: 28 },
          { x: 22, y: 22 },
        ],
      ],
    },
  ];

  describe('generateDXF', () => {
    it('should generate valid DXF structure', () => {
      const polygons = createTestPolygons();
      const dxf = generateDXF(polygons, 100, 100, false);

      // Check for required DXF sections
      expect(dxf).toContain('SECTION');
      expect(dxf).toContain('HEADER');
      expect(dxf).toContain('TABLES');
      expect(dxf).toContain('ENTITIES');
      expect(dxf).toContain('ENDSEC');
      expect(dxf).toContain('EOF');
    });

    it('should include VectorWorks layers', () => {
      const polygons = createTestPolygons();
      const dxf = generateDXF(polygons, 100, 100, false);

      // Check for VectorWorks-specific layers
      expect(dxf).toContain('VW_CLASS_Detail');
      expect(dxf).toContain('VW_CLASS_Fill');
    });

    it('should generate LWPOLYLINE entities', () => {
      const polygons = createTestPolygons();
      const dxf = generateDXF(polygons, 100, 100, false);

      // Check for LWPOLYLINE entities
      expect(dxf).toContain('LWPOLYLINE');
      
      // Count LWPOLYLINE occurrences (should have one for each exterior + holes)
      const lwpolylineCount = (dxf.match(/LWPOLYLINE/g) || []).length;
      expect(lwpolylineCount).toBe(3); // 2 exteriors + 1 hole
    });

    it('should mark polylines as closed', () => {
      const polygons = createTestPolygons();
      const dxf = generateDXF(polygons, 100, 100, false);

      // Check for closed polyline flags (70 = 1)
      const lines = dxf.split('\n');
      let foundClosedFlags = 0;
      
      for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i].trim() === '70' && lines[i + 1].trim() === '1') {
          foundClosedFlags++;
        }
      }
      
      expect(foundClosedFlags).toBeGreaterThan(0); // Should have closed flags
    });

    it('should include HATCH entities when whiteFill is true', () => {
      const polygons = createTestPolygons();
      const dxf = generateDXF(polygons, 100, 100, true);

      // Check for HATCH entities
      expect(dxf).toContain('HATCH');
      expect(dxf).toContain('SOLID'); // Solid fill pattern
      
      // Count HATCH occurrences (should have one for each polygon)
      const hatchCount = (dxf.match(/HATCH/g) || []).length;
      expect(hatchCount).toBe(2); // One for each polygon
    });

    it('should not include HATCH entities when whiteFill is false', () => {
      const polygons = createTestPolygons();
      const dxf = generateDXF(polygons, 100, 100, false);

      // Should not contain HATCH entities
      expect(dxf).not.toContain('HATCH');
    });

    it('should handle polygons with holes in HATCH', () => {
      const polygons = createTestPolygons();
      const dxf = generateDXF(polygons, 100, 100, true);

      // Check for boundary path count in HATCH
      // Polygon with hole should have 2 boundary paths (exterior + hole)
      expect(dxf).toContain('91'); // Number of boundary paths code
      expect(dxf).toContain('2');  // Should have 2 paths for polygon with hole
    });

    it('should format coordinates properly', () => {
      const polygons = [
        {
          exterior: [
            { x: 1.123456789, y: 2.987654321 },
            { x: 10.5, y: 0 },
            { x: 10, y: 10.333333 },
            { x: 0, y: 10 },
            { x: 1.123456789, y: 2.987654321 },
          ],
          holes: [],
        },
      ];
      
      const dxf = generateDXF(polygons, 100, 100, false);

      // Check that coordinates are formatted with appropriate precision
      expect(dxf).toContain('1.123457'); // Should be rounded to 6 decimal places
      expect(dxf).toContain('2.987654');
      expect(dxf).toContain('10.333333');
    });
  });

  describe('generateMinimalDXF', () => {
    it('should generate minimal DXF structure', () => {
      const polygons = createTestPolygons();
      const dxf = generateMinimalDXF(polygons, false);

      // Check for minimal required sections
      expect(dxf).toContain('SECTION');
      expect(dxf).toContain('ENTITIES');
      expect(dxf).toContain('ENDSEC');
      expect(dxf).toContain('EOF');
      
      // Should not contain complex header/tables
      expect(dxf).not.toContain('HEADER');
      expect(dxf).not.toContain('TABLES');
    });

    it('should include LWPOLYLINE entities', () => {
      const polygons = createTestPolygons();
      const dxf = generateMinimalDXF(polygons, false);

      expect(dxf).toContain('LWPOLYLINE');
      expect(dxf).toContain('VW_CLASS_Detail');
      
      // Should have closed polylines
      expect(dxf).toContain('70');
      expect(dxf).toContain('1'); // Closed flag
    });

    it('should be shorter than full DXF', () => {
      const polygons = createTestPolygons();
      const fullDxf = generateDXF(polygons, 100, 100, false);
      const minimalDxf = generateMinimalDXF(polygons, false);

      expect(minimalDxf.length).toBeLessThan(fullDxf.length);
    });
  });

  describe('validateDXFOutput', () => {
    it('should validate correct DXF', () => {
      const polygons = createTestPolygons();
      const dxf = generateDXF(polygons, 100, 100, false);
      
      const validation = validateDXFOutput(dxf);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing sections', () => {
      const invalidDxf = 'LWPOLYLINE\n8\nVW_CLASS_Detail\nEOF';
      
      const validation = validateDXFOutput(invalidDxf);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(e => e.includes('SECTION'))).toBe(true);
    });

    it('should detect missing EOF', () => {
      const invalidDxf = '0\nSECTION\n2\nENTITIES\n0\nENDSEC';
      
      const validation = validateDXFOutput(invalidDxf);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(e => e.includes('EOF'))).toBe(true);
    });

    it('should warn about missing VW layers', () => {
      const dxfWithoutVWLayers = '0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n8\nLayer0\n0\nENDSEC\n0\nEOF';
      
      const validation = validateDXFOutput(dxfWithoutVWLayers);
      
      expect(validation.warnings.some(w => w.includes('VW_CLASS_Detail'))).toBe(true);
    });

    it('should validate closed polylines', () => {
      const polygons = createTestPolygons();
      const dxf = generateDXF(polygons, 100, 100, false);
      
      const validation = validateDXFOutput(dxf);
      
      // Should not warn about unclosed polylines since we generate closed ones
      expect(validation.warnings.some(w => w.includes('unclosed'))).toBe(false);
    });
  });

  describe('DXF CAD compatibility', () => {
    it('should generate only closed LWPOLYLINE entities', () => {
      const polygons = createTestPolygons();
      const dxf = generateDXF(polygons, 100, 100, false);

      // Should not contain SPLINE or LINE entities
      expect(dxf).not.toContain('SPLINE');
      expect(dxf).not.toContain('\nLINE\n'); // Avoid matching "LWPOLYLINE"
      
      // All LWPOLYLINE should be closed
      const lines = dxf.split('\n');
      let lwpolylineFound = false;
      let closedFlagFound = false;
      
      for (let i = 0; i < lines.length - 1; i++) {
        if (lines[i].trim() === 'LWPOLYLINE') {
          lwpolylineFound = true;
        }
        if (lwpolylineFound && lines[i].trim() === '70' && lines[i + 1].trim() === '1') {
          closedFlagFound = true;
          lwpolylineFound = false; // Reset for next polyline
        }
      }
      
      expect(closedFlagFound).toBe(true);
    });

    it('should use correct layer names for VectorWorks', () => {
      const polygons = createTestPolygons();
      const dxf = generateDXF(polygons, 100, 100, true);

      // Check for exact VectorWorks layer names
      expect(dxf).toContain('VW_CLASS_Detail');
      expect(dxf).toContain('VW_CLASS_Fill');
      
      // Should not contain generic layer names
      expect(dxf).not.toContain('Layer0');
      expect(dxf).not.toContain('Default');
    });

    it('should implement even-odd fill rule in HATCH', () => {
      const polygonWithHole = {
        exterior: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 20 },
          { x: 0, y: 20 },
          { x: 0, y: 0 },
        ],
        holes: [
          [
            { x: 5, y: 5 },
            { x: 15, y: 5 },
            { x: 15, y: 15 },
            { x: 5, y: 15 },
            { x: 5, y: 5 },
          ],
        ],
      };

      const dxf = generateDXF([polygonWithHole], 100, 100, true);

      // Check for boundary path flags
      expect(dxf).toContain('92'); // Boundary path type flag
      expect(dxf).toContain('2');  // Exterior path flag
      expect(dxf).toContain('16'); // Internal path flag (hole)
    });

    it('should handle empty polygon list', () => {
      const dxf = generateDXF([], 100, 100, false);
      
      // Should still generate valid DXF structure
      expect(dxf).toContain('SECTION');
      expect(dxf).toContain('ENTITIES');
      expect(dxf).toContain('EOF');
      
      // Should not contain any polylines
      expect(dxf).not.toContain('LWPOLYLINE');
    });

    it('should handle degenerate polygons gracefully', () => {
      const degeneratePolygons = [
        {
          exterior: [{ x: 0, y: 0 }, { x: 1, y: 1 }], // Too few points
          holes: [],
        },
        {
          exterior: [], // Empty
          holes: [],
        },
      ];

      const dxf = generateDXF(degeneratePolygons, 100, 100, false);
      
      // Should generate valid DXF without crashing
      expect(dxf).toContain('EOF');
      
      // Should not contain LWPOLYLINE for degenerate polygons
      expect(dxf).not.toContain('LWPOLYLINE');
    });
  });
});