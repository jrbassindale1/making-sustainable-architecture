// Architectural dimension constants for BuildingPreview
export const WALL_THICKNESS = 0.3;
export const FLOOR_THICKNESS = 0.12;
export const BUILDING_LIFT = 0.25;
export const PLINTH_HEIGHT = 0.15;
export const PLINTH_RECESS = 0.15;
export const PARAPET_UPSTAND_HEIGHT = 0.2; // 200 mm above roof slab top
export const PARAPET_CLADDING_THICKNESS = 0.02;
export const SLAB_EDGE_PULLBACK = 0.02; // 20 mm set back from outer wall/cladding line
export const COPING_THICKNESS = 0.05;
export const COPING_OVERHANG = 0.02;
export const WINDOW_CILL_THICKNESS = 0.02;
export const WINDOW_CILL_PROJECTION = 0.08;
export const WINDOW_CILL_END_OVERHANG = 0.04;
export const WINDOW_CILL_FRAME_OVERLAP = 0.005; // tuck cill 5 mm under frame
export const WINDOW_CILL_VERTICAL_OVERLAP = 0.005; // raise cill 5 mm into frame line to avoid clash
export const WINDOW_OPEN_TRAVEL = 0.15; // 150 mm
export const MAX_WINDOW_LEAF_WIDTH = 0.9; // 900 mm
export const ROOFLIGHT_FRAME_THICKNESS = 0.05;
export const ROOFLIGHT_PANEL_THICKNESS = 0.02;
export const ROOFLIGHT_SASH_PROFILE = 0.04;
// Align rooflight glass top close to parapet coping top level.
export const ROOFLIGHT_UPSTAND_HEIGHT =
  PARAPET_UPSTAND_HEIGHT + COPING_THICKNESS - ROOFLIGHT_PANEL_THICKNESS * 0.8;
export const GRAVEL_STRIP_WIDTH = 1.5; // 1.5 m perimeter band around external wall line
export const CLADDING_TILE_WIDTH_M = 0.96; // 8 boards per tile -> ~120 mm board module
export const CLADDING_TILE_HEIGHT_M = 2.4;
export const SHOW_SYNTHETIC_SUN_PATCHES = false;
export const DOWNLIGHT_TRIM_RADIUS_M = 0.1;
export const DOWNLIGHT_TRIM_THICKNESS_M = 0.02;
export const DOWNLIGHT_BEAM_RADIUS_M = 0.095;
export const DOWNLIGHT_BEAM_LENGTH_M = 0.08;
export const OVERHANG_COLUMN_SIZE = 0.3; // 300 mm x 300 mm columns (match wall thickness)
