import type { Polygon, Point } from '../../../../shared/types';

/**
 * Generate DXF output with closed LWPOLYLINE entities
 * Ensures CAD-compatible format with proper layer structure
 */
export function generateDXF(
  polygons: Polygon[],
  width: number,
  height: number,
  whiteFill: boolean = false
): string {
  const dxfContent: string[] = [];
  
  // DXF Header
  dxfContent.push(...generateDXFHeader());
  
  // DXF Tables (layers, etc.)
  dxfContent.push(...generateDXFTables());
  
  // DXF Entities
  dxfContent.push(...generateDXFEntities(polygons, whiteFill));
  
  // DXF Footer
  dxfContent.push(...generateDXFFooter());
  
  return dxfContent.join('\n');
}

/**
 * Generate DXF header section
 */
function generateDXFHeader(): string[] {
  return [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$ACADVER',
    '1',
    'AC1015', // AutoCAD 2000 format for compatibility
    '9',
    '$HANDSEED',
    '5',
    'FFFF',
    '9',
    '$MEASUREMENT',
    '70',
    '1', // Metric units
    '0',
    'ENDSEC'
  ];
}

/**
 * Generate DXF tables section with layers
 */
function generateDXFTables(): string[] {
  return [
    '0',
    'SECTION',
    '2',
    'TABLES',
    
    // Layer table
    '0',
    'TABLE',
    '2',
    'LAYER',
    '5',
    '2',
    '330',
    '0',
    '100',
    'AcDbSymbolTable',
    '70',
    '2', // Number of layers
    
    // VW_CLASS_Detail layer
    '0',
    'LAYER',
    '5',
    '10',
    '330',
    '2',
    '100',
    'AcDbSymbolTableRecord',
    '100',
    'AcDbLayerTableRecord',
    '2',
    'VW_CLASS_Detail',
    '70',
    '0',
    '62',
    '7', // White color
    '6',
    'CONTINUOUS',
    '370',
    '25', // Line weight 0.25mm
    
    // VW_CLASS_Fill layer
    '0',
    'LAYER',
    '5',
    '11',
    '330',
    '2',
    '100',
    'AcDbSymbolTableRecord',
    '100',
    'AcDbLayerTableRecord',
    '2',
    'VW_CLASS_Fill',
    '70',
    '0',
    '62',
    '1', // Red color for visibility
    '6',
    'CONTINUOUS',
    '370',
    '0', // Default line weight
    
    '0',
    'ENDTAB',
    '0',
    'ENDSEC'
  ];
}

/**
 * Generate DXF entities section
 */
function generateDXFEntities(polygons: Polygon[], whiteFill: boolean): string[] {
  const entities: string[] = [
    '0',
    'SECTION',
    '2',
    'ENTITIES'
  ];
  
  let handleCounter = 100;
  
  // Generate LWPOLYLINE entities for contours
  for (const polygon of polygons) {
    // Exterior contour
    const exteriorEntity = generateLWPolyline(
      polygon.exterior,
      'VW_CLASS_Detail',
      (handleCounter++).toString(16).toUpperCase()
    );
    entities.push(...exteriorEntity);
    
    // Hole contours
    for (const hole of polygon.holes) {
      const holeEntity = generateLWPolyline(
        hole,
        'VW_CLASS_Detail',
        (handleCounter++).toString(16).toUpperCase()
      );
      entities.push(...holeEntity);
    }
    
    // Generate HATCH entity for fill if enabled
    if (whiteFill) {
      const hatchEntity = generateHatchEntity(
        polygon,
        'VW_CLASS_Fill',
        (handleCounter++).toString(16).toUpperCase()
      );
      entities.push(...hatchEntity);
    }
  }
  
  entities.push('0', 'ENDSEC');
  return entities;
}

/**
 * Generate LWPOLYLINE entity (closed polyline)
 */
function generateLWPolyline(points: Point[], layer: string, handle: string): string[] {
  if (points.length < 3) return [];
  
  const entity: string[] = [
    '0',
    'LWPOLYLINE',
    '5',
    handle,
    '330',
    '1F',
    '100',
    'AcDbEntity',
    '8',
    layer, // Layer name
    '100',
    'AcDbPolyline',
    '90',
    points.length.toString(), // Number of vertices
    '70',
    '1' // Closed polyline flag
  ];
  
  // Add vertex coordinates
  for (const point of points) {
    entity.push(
      '10',
      formatDXFCoordinate(point.x), // X coordinate
      '20',
      formatDXFCoordinate(point.y)  // Y coordinate
    );
  }
  
  return entity;
}

/**
 * Generate HATCH entity with even-odd fill rule
 */
function generateHatchEntity(polygon: Polygon, layer: string, handle: string): string[] {
  const entity: string[] = [
    '0',
    'HATCH',
    '5',
    handle,
    '330',
    '1F',
    '100',
    'AcDbEntity',
    '8',
    layer, // Layer name
    '62',
    '7', // White color
    '100',
    'AcDbHatch',
    '10',
    '0.0', // Elevation point X
    '20',
    '0.0', // Elevation point Y
    '30',
    '0.0', // Elevation point Z
    '210',
    '0.0', // Extrusion direction X
    '220',
    '0.0', // Extrusion direction Y
    '230',
    '1.0', // Extrusion direction Z
    '2',
    'SOLID', // Hatch pattern name
    '70',
    '1', // Solid fill flag
    '71',
    '0', // Associativity flag
    '91',
    (1 + polygon.holes.length).toString() // Number of boundary paths
  ];
  
  // Exterior boundary path
  entity.push(...generateBoundaryPath(polygon.exterior, 2)); // Exterior path flag
  
  // Hole boundary paths
  for (const hole of polygon.holes) {
    entity.push(...generateBoundaryPath(hole, 16)); // Internal path flag
  }
  
  // Hatch style
  entity.push(
    '75',
    '1', // Hatch style (normal)
    '76',
    '1', // Hatch pattern type (predefined)
    '98',
    '1', // Number of seed points
    '10',
    '0.0', // Seed point X
    '20',
    '0.0'  // Seed point Y
  );
  
  return entity;
}

/**
 * Generate boundary path for HATCH entity
 */
function generateBoundaryPath(points: Point[], pathFlag: number): string[] {
  if (points.length < 3) return [];
  
  const path: string[] = [
    '92',
    pathFlag.toString(), // Boundary path type flag
    '93',
    '1', // Number of edges in path
    '72',
    '1', // Edge type (line)
    '94',
    points.length.toString() // Number of vertices
  ];
  
  // Add vertex coordinates
  for (const point of points) {
    path.push(
      '10',
      formatDXFCoordinate(point.x), // X coordinate
      '20',
      formatDXFCoordinate(point.y)  // Y coordinate
    );
  }
  
  path.push(
    '97',
    '0' // Number of source boundary objects
  );
  
  return path;
}

/**
 * Generate DXF footer section
 */
function generateDXFFooter(): string[] {
  return [
    '0',
    'SECTION',
    '2',
    'OBJECTS',
    '0',
    'DICTIONARY',
    '5',
    'C',
    '330',
    '0',
    '100',
    'AcDbDictionary',
    '281',
    '1',
    '3',
    'ACAD_GROUP',
    '350',
    'D',
    '0',
    'DICTIONARY',
    '5',
    'D',
    '330',
    'C',
    '100',
    'AcDbDictionary',
    '281',
    '1',
    '0',
    'ENDSEC',
    '0',
    'EOF'
  ];
}

/**
 * Format coordinate for DXF output
 * Ensures appropriate precision and format
 */
function formatDXFCoordinate(value: number): string {
  return Number(value.toFixed(6)).toString();
}

/**
 * Generate minimal DXF with only essential elements
 */
export function generateMinimalDXF(polygons: Polygon[], whiteFill: boolean = false): string {
  const dxfLines: string[] = [
    '0', 'SECTION',
    '2', 'ENTITIES'
  ];
  
  let handleCounter = 100;
  
  // Generate only LWPOLYLINE entities
  for (const polygon of polygons) {
    // Exterior contour
    if (polygon.exterior.length >= 3) {
      dxfLines.push(
        '0', 'LWPOLYLINE',
        '8', 'VW_CLASS_Detail',
        '90', polygon.exterior.length.toString(),
        '70', '1' // Closed flag
      );
      
      for (const point of polygon.exterior) {
        dxfLines.push(
          '10', formatDXFCoordinate(point.x),
          '20', formatDXFCoordinate(point.y)
        );
      }
    }
    
    // Holes
    for (const hole of polygon.holes) {
      if (hole.length >= 3) {
        dxfLines.push(
          '0', 'LWPOLYLINE',
          '8', 'VW_CLASS_Detail',
          '90', hole.length.toString(),
          '70', '1' // Closed flag
        );
        
        for (const point of hole) {
          dxfLines.push(
            '10', formatDXFCoordinate(point.x),
            '20', formatDXFCoordinate(point.y)
          );
        }
      }
    }
  }
  
  dxfLines.push(
    '0', 'ENDSEC',
    '0', 'EOF'
  );
  
  return dxfLines.join('\n');
}

/**
 * Validate DXF output for CAD compatibility
 */
export function validateDXFOutput(dxfContent: string): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check for required sections
  if (!dxfContent.includes('SECTION')) {
    errors.push('Missing SECTION declarations');
  }
  
  if (!dxfContent.includes('ENTITIES')) {
    errors.push('Missing ENTITIES section');
  }
  
  if (!dxfContent.includes('EOF')) {
    errors.push('Missing EOF marker');
  }
  
  // Check for closed polylines
  const lwpolylineMatches = dxfContent.match(/LWPOLYLINE[\s\S]*?(?=0\s+(?:LWPOLYLINE|HATCH|ENDSEC))/g);
  if (lwpolylineMatches) {
    for (const match of lwpolylineMatches) {
      if (!match.includes('70\n1')) {
        warnings.push('Found unclosed LWPOLYLINE - should be closed for CAD compatibility');
      }
    }
  }
  
  // Check layer names
  if (!dxfContent.includes('VW_CLASS_Detail')) {
    warnings.push('Missing VW_CLASS_Detail layer');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}