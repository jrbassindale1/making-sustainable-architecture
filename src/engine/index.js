/* -------------------- Reference data -------------------- */
export const WEATHER_FILE_URL = "/weather/GBR_WAL_Pencelli.Aux.036100_TMYx.epw";
export const DEFAULT_SITE = {
  name: "Pencelli (Brecon)",
  latitude: 51.917,
  longitude: -3.317,
  tzHours: 0,
  elevationM: 160,
};
export const SYNTHETIC_PROFILE = {
  ...DEFAULT_SITE,
  temps: { summer: 23, winter: 6 },
  diurnalRange: 8,
};

export const FACES = [
  { id: "north", label: "North", azimuth: 0, accent: "#6366f1" },
  { id: "east", label: "East", azimuth: 90, accent: "#059669" },
  { id: "south", label: "South", azimuth: 180, accent: "#0f766e" },
  { id: "west", label: "West", azimuth: 270, accent: "#1d4ed8" },
];

export const BUILDING_WIDTH = 2.4;
export const BUILDING_DEPTH = 4.8;
export const BUILDING_HEIGHT = 2.6;

export const U_VALUE_PRESETS = {
  baseline: {
    label: "Baseline - Building Regs 2025",
    detail: "Low-E double glazing and solid insulation.",
    values: {
      wall: 0.35,
      roof: 0.2,
      floor: 0.25,
      window: 1.1,
    },
  },
  improved: {
    label: "25% Above Baseline",
    detail: "Upgraded insulation and better glazing.",
    values: {
      wall: 0.25,
      roof: 0.15,
      floor: 0.2,
      window: 0.9,
    },
  },
  high: {
    label: "High-performance",
    detail: "Super-insulated envelope with high spec glazing.",
    values: {
      wall: 0.15,
      roof: 0.15,
      floor: 0.15,
      window: 0.7,
    },
  },
  passivhaus: {
    label: "Passivhaus (indicative)",
    detail: "Indicative Passivhaus-style fabric values for early-stage option testing (not certification).",
    values: {
      wall: 0.1,
      roof: 0.1,
      floor: 0.1,
      window: 0.8,
    },
  },
};
export const U_VALUE_PRESET_ORDER = ["baseline", "improved", "high", "passivhaus"];
export const DEFAULT_U_VALUE_PRESET = "high";

export const MODEL_YEAR = 2025;
export const DAYS_PER_YEAR = 365;
export const SUMMER_SOLSTICE_DAY = 172;
export const WINTER_SOLSTICE_DAY = 355;
export const SPRING_EQUINOX_DAY = 79;
export const AUTUMN_EQUINOX_DAY = 265;
export const SIMULATION_STEP_MINUTES = 10;
export const SIMULATION_SPINUP_DAYS = 7;
export const THERMAL_CAPACITANCE_J_PER_K = 6_000_000;
export const COMFORT_BAND = { min: 18, max: 23 };
export const RHO_AIR = 1.2;
export const CP_AIR = 1006;
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 6;
export const ACH_INFILTRATION_DEFAULT = 0.3;
export const VENTILATION_PRESETS = {
  background: {
    label: "Background only",
    detail: "Standard infiltration only.",
    achTotal: ACH_INFILTRATION_DEFAULT,
  },
  trickle: {
    label: "Trickle vents",
    detail: "Low, steady ventilation.",
    achTotal: 0.6,
  },
  passivhaus: {
    label: "MVHR (Passivhaus-style)",
    detail: "Indicative continuous balanced ventilation for a well-sealed envelope with heat recovery.",
    achTotal: 0.4,
    heatRecoveryEfficiency: 0.85,
  },
  open: {
    label: "Open windows",
    detail: "Typical daytime opening.",
    achTotal: 3.0,
  },
  purge: {
    label: "Purge",
    detail: "High ventilation for rapid cooling.",
    achTotal: 6.0,
  },
  adaptive: {
    label: "Adaptive",
    detail: `Windows open automatically when cooling is beneficial. Ventilation scales from 0.6 to 6.0 ACH as indoor temperature exceeds the comfort maximum (${COMFORT_BAND.max}°C). Night cooling stops at ${COMFORT_BAND.min}°C to prevent overcooling, and only runs when outdoor air is at least 1°C cooler than indoor.`,
    achTotal: ACH_INFILTRATION_DEFAULT,
    isAdaptive: true,
  },
};
export const VENTILATION_PRESET_ORDER = ["background", "trickle", "passivhaus", "open", "adaptive"];
export const DEFAULT_VENTILATION_PRESET = "background";
export const MAX_VENTILATION_ACH = Math.max(
  ...Object.values(VENTILATION_PRESETS).map((preset) => preset.achTotal),
);

export const ADAPTIVE_VENTILATION_CONFIG = {
  nightFloorTemp: 18,
  minBenefitDelta: 1,
  overheatScaleMax: 3,
  achRange: { min: 0.6, max: 6.0 },
};
export const MVHR_CONTROL_CONFIG = {
  boostAch: 0.8,
  summerBoostAch: 1.2,
  occupiedMorningStartHour: 6,
  occupiedMorningEndHour: 9,
  occupiedEveningStartHour: 17,
  occupiedEveningEndHour: 22,
  bypassBenefitDeltaC: 0.5,
};

/* -------------------- Energy cost + carbon assumptions -------------------- */
export const HEATING_SYSTEM = {
  label: "High-efficiency gas boiler",
  fuel: "gas",
  efficiency: 0.9,
};
export const COOLING_SYSTEM = {
  label: "Electric DX cooling",
  fuel: "electricity",
  cop: 3.0,
};

// Base electrical loads (lighting, small power, ventilation fans)
// These run regardless of heating/cooling and must be offset for true zero carbon
export const BASE_ELECTRICAL_LOADS = {
  lighting: {
    label: "LED lighting",
    powerDensityWm2: 8, // W/m² when on (efficient LED)
    dailyHours: 6, // Average hours per day (varies by season, simplified)
  },
  smallPower: {
    label: "Small power (plugs)",
    powerDensityWm2: 5, // W/m² average when occupied
    dailyHours: 8, // Hours per day
  },
  mvhrFans: {
    label: "MVHR fans",
    powerW: 15, // Continuous fan power for small unit (W)
    dailyHours: 24, // Runs continuously
  },
};

export const PRICE_CAP_PERIOD_LABEL = "1 Jan-31 Mar 2026";
export const ENERGY_TARIFFS = {
  electricity: {
    unitRate: 0.2769,
    standingChargePerDay: 0.5475,
    exportRate: 0.15, // Smart Export Guarantee (SEG) typical rate
  },
  gas: {
    unitRate: 0.0593,
    standingChargePerDay: 0.3509,
  },
};
export const CARBON_FACTORS = {
  electricity: {
    generation: 0.177,
    tAndD: 0.01853,
    consumption: 0.177 + 0.01853,
    year: 2025,
  },
  gas: {
    perKWh: 0.20268,
    year: 2025,
  },
};
export const INCLUDE_STANDING_CHARGES = true;

// LETI Net Zero Operational Carbon targets (kgCO₂e/m²/year)
// Source: LETI Climate Emergency Design Guide (2020)
export const LETI_TARGETS = {
  residential: {
    label: "Residential",
    target: 35, // kgCO₂e/m²/year
  },
  office: {
    label: "Office",
    target: 55, // kgCO₂e/m²/year
  },
  retail: {
    label: "Retail",
    target: 50, // kgCO₂e/m²/year
  },
  hotel: {
    label: "Hotel",
    target: 55, // kgCO₂e/m²/year
  },
};
export const DEFAULT_LETI_TARGET = "residential";

/* -------------------- Daylight / Illuminance -------------------- */
// Luminous efficacy: converts solar irradiance (W/m²) to illuminance (lux)
// Clear sky ~105 lm/W, overcast ~120 lm/W, average ~115 lm/W
export const LUMINOUS_EFFICACY = 115;

// Visible light transmittance is typically higher than SHGC (g_glass) for low-E glazing
// VLT/SHGC ratio is usually ~1.5-1.8 for modern low-E glass
export const VLT_TO_SHGC_RATIO = 1.6;

// Lux thresholds for educational guidance
export const LUX_THRESHOLDS = {
  dim: 100,        // Below this: needs artificial light
  adequate: 300,   // General circulation, casual tasks
  good: 500,       // Office work, reading
  bright: 1000,    // Detailed tasks, drawing
};

/**
 * Calculate desk-level illuminance (lux) at room centre
 * Uses a simplified daylight factor approach suitable for teaching
 *
 * @param {number} GHI - Global Horizontal Irradiance [W/m²]
 * @param {number} totalWindowArea - Total glazed area [m²]
 * @param {number} floorArea - Room floor area [m²]
 * @param {number} g_glass - Solar heat gain coefficient (SHGC)
 * @param {number} roomDepth - Distance from window to back wall [m]
 * @returns {number} Illuminance at desk height [lux]
 */
export function calculateDeskIlluminance(GHI, totalWindowArea, floorArea, g_glass, roomDepth) {
  if (!Number.isFinite(GHI) || GHI <= 0) return 0;

  // Convert irradiance to outdoor illuminance
  const outdoorLux = GHI * LUMINOUS_EFFICACY;

  // Estimate visible light transmittance from SHGC
  const VLT = Math.min(0.9, g_glass * VLT_TO_SHGC_RATIO);

  // Simplified daylight factor calculation
  // DF = (Aw × T × θ) / (A × (1 - R²))
  // Where: Aw = window area, T = transmittance, θ = sky angle factor (~0.5 for vertical windows)
  //        A = total room surface area, R = average reflectance (~0.5)
  // Simplified: DF ≈ (window area × VLT × 0.4) / (floor area × 2)
  const skyFactor = 0.4; // accounts for window orientation and obstruction
  const roomFactor = 2.0; // accounts for room depth and surface absorption

  const daylightFactor = (totalWindowArea * VLT * skyFactor) / (floorArea * roomFactor);

  // Apply depth correction: light falls off toward back of room
  // At room centre (depth/2), we get ~70% of window-adjacent light
  const depthCorrection = Math.max(0.3, 1 - (roomDepth / 2) * 0.1);

  // Calculate desk illuminance
  const deskLux = outdoorLux * daylightFactor * depthCorrection;

  return Math.round(Math.max(0, deskLux));
}

/**
 * Classify illuminance level for UI display
 */
export function classifyIlluminance(lux) {
  if (lux < LUX_THRESHOLDS.dim) return { level: "dim", label: "Dim", description: "Artificial light needed" };
  if (lux < LUX_THRESHOLDS.adequate) return { level: "adequate", label: "Adequate", description: "Casual tasks" };
  if (lux < LUX_THRESHOLDS.good) return { level: "good", label: "Good", description: "Office work" };
  if (lux < LUX_THRESHOLDS.bright) return { level: "bright", label: "Bright", description: "Detailed tasks" };
  return { level: "very_bright", label: "Very bright", description: "May need shading" };
}

/* -------------------- Ventilation opening area -------------------- */
// Constants for natural ventilation calculation
const DISCHARGE_COEFFICIENT = 0.6; // Typical for window openings
const CROSS_VENT_VELOCITY = 0.75; // m/s reference velocity for opening-area equivalence helper
const GRAVITY_MPS2 = 9.81;
const KELVIN_OFFSET = 273.15;
const DEFAULT_SYNTHETIC_WIND_MS = 2.2;
const PRESSURE_COEFF_SINGLE_SIDED = 0.05; // turbulent single-sided pressure difference
const PRESSURE_COEFF_MULTI_FACE = 0.1; // adjacent facades with modest directional pressure
const PRESSURE_COEFF_CROSS = 0.35; // opposite facades (windward/leeward path)
const PRESSURE_COEFF_ROOF_TO_FACADE = 0.18; // roof suction vs facade pressure
const PRESSURE_COEFF_ROOF_ONLY = 0.12; // rooflight-only case with infiltration make-up path
const MIN_STACK_HEIGHT_M = 0.5;
const MAKEUP_AREA_RATIO_OF_FLOOR = 0.004;
const MIN_MAKEUP_AREA_M2 = 0.02;
const WIND_SPEED_SHELTER_FACTOR = 0.35; // EPW wind is often exposed 10m wind; reduce to sheltered opening level
const MAX_EFFECTIVE_OPENING_VELOCITY_MPS = 1.2; // practical natural-vent opening jet speed in small rooms
const TOP_HUNG_OPENING_EFFECTIVENESS = 0.65;
const TURN_OPENING_EFFECTIVENESS = 0.45;
const WINDOW_FRAME_PROFILE = 0.05; // 50 mm fixed frame
export const WINDOW_OPEN_TRAVEL_M = 0.15; // 150 mm opening travel
export const MAX_WINDOW_LEAF_WIDTH_M = 0.9; // 900 mm maximum leaf width
export const MODEL_WALL_THICKNESS_M = 0.3;
export const MODEL_SLAB_EDGE_PULLBACK_M = 0.02;
export const ROOFLIGHT_MAX_EDGE_OFFSET_M = 0.5; // min clearance from inside parapet
export const ROOFLIGHT_MAX_OPEN_M = 0.2;
export const ROOFLIGHT_MIN_CLEAR_SPAN_M = 1.0;
export const WINDOW_SEGMENT_STATE = {
  CLOSED: 0,
  TOP_HUNG: 1,
  TURN: 2,
};

export function normalizeWindowSegmentState(value) {
  if (typeof value === "boolean") {
    return value ? WINDOW_SEGMENT_STATE.TOP_HUNG : WINDOW_SEGMENT_STATE.CLOSED;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return WINDOW_SEGMENT_STATE.CLOSED;
  const rounded = Math.round(numeric);
  if (rounded <= WINDOW_SEGMENT_STATE.CLOSED) return WINDOW_SEGMENT_STATE.CLOSED;
  if (rounded >= WINDOW_SEGMENT_STATE.TURN) return WINDOW_SEGMENT_STATE.TURN;
  return rounded;
}

export function nextWindowSegmentState(state) {
  const current = normalizeWindowSegmentState(state);
  if (current === WINDOW_SEGMENT_STATE.CLOSED) return WINDOW_SEGMENT_STATE.TOP_HUNG;
  if (current === WINDOW_SEGMENT_STATE.TOP_HUNG) return WINDOW_SEGMENT_STATE.TURN;
  return WINDOW_SEGMENT_STATE.CLOSED;
}

export function calculateRoofPlanDimensions(dimensions = {}) {
  const width = Number.isFinite(dimensions.width) ? dimensions.width : BUILDING_WIDTH;
  const depth = Number.isFinite(dimensions.depth) ? dimensions.depth : BUILDING_DEPTH;
  const slabExtraEachSide = Math.max(
    0,
    MODEL_WALL_THICKNESS_M - MODEL_SLAB_EDGE_PULLBACK_M,
  );
  return {
    roofWidth: width + slabExtraEachSide * 2,
    roofDepth: depth + slabExtraEachSide * 2,
  };
}

export function resolveRooflightConfig(rooflight = {}, dimensions = {}) {
  const insideParapetWidth = Number.isFinite(dimensions.width)
    ? dimensions.width
    : BUILDING_WIDTH;
  const insideParapetDepth = Number.isFinite(dimensions.depth)
    ? dimensions.depth
    : BUILDING_DEPTH;
  const minSpan = ROOFLIGHT_MIN_CLEAR_SPAN_M;
  const maxWidth = Math.max(
    minSpan,
    insideParapetWidth - ROOFLIGHT_MAX_EDGE_OFFSET_M * 2,
  );
  const maxDepth = Math.max(
    minSpan,
    insideParapetDepth - ROOFLIGHT_MAX_EDGE_OFFSET_M * 2,
  );
  const width = Math.max(
    minSpan,
    Math.min(
      Number.isFinite(rooflight.width) ? rooflight.width : minSpan,
      maxWidth,
    ),
  );
  const depth = Math.max(
    minSpan,
    Math.min(
      Number.isFinite(rooflight.depth) ? rooflight.depth : minSpan,
      maxDepth,
    ),
  );
  const centerX = 0;
  const centerZ = 0;
  const westInset = (insideParapetWidth - width) / 2;
  const eastInset = westInset;
  const northInset = (insideParapetDepth - depth) / 2;
  const southInset = northInset;
  const openHeight = Math.max(
    0,
    Math.min(Number.isFinite(rooflight.openHeight) ? rooflight.openHeight : 0, ROOFLIGHT_MAX_OPEN_M),
  );
  const openingEdgeLength = width;
  const openingAreaM2 = Math.max(0, openingEdgeLength * openHeight);

  return {
    roofWidth: insideParapetWidth,
    roofDepth: insideParapetDepth,
    width,
    depth,
    maxWidth,
    maxDepth,
    centerX,
    centerZ,
    northInset,
    southInset,
    westInset,
    eastInset,
    openHeight,
    openingEdgeLength,
    openingAreaM2,
    isOpen: openHeight > 1e-6,
  };
}

/**
 * Calculate the required free opening area to achieve a given ACH
 * Uses simplified natural ventilation formula: Q = Cd × A × v
 *
 * @param {number} achTotal - Target air changes per hour
 * @param {number} volume - Room volume [m³]
 * @returns {object} Opening area info with area in m² and formatted examples
 */
export function calculateOpeningArea(achTotal, volume) {
  // Q = ACH × Volume / 3600 (convert to m³/s)
  const flowRate = (achTotal * volume) / 3600;

  // A = Q / (Cd × v_eff)
  const openingAreaM2 = flowRate / (DISCHARGE_COEFFICIENT * CROSS_VENT_VELOCITY);

  // Calculate equivalent square sash dimensions (mm)
  const sashSideMm = Math.round(Math.sqrt(openingAreaM2) * 1000);

  // Calculate percentage opening for a standard 600×600mm casement
  const casementArea = 0.36; // 600mm × 600mm = 0.36 m²
  const casementPercent = Math.round((openingAreaM2 / casementArea) * 100);

  return {
    areaM2: openingAreaM2,
    sashSideMm,
    casementPercent: Math.min(100, casementPercent),
  };
}

export function calculateAchFromOpeningArea(openingAreaM2, volume) {
  const safeVolume = Math.max(0, Number.isFinite(volume) ? volume : 0);
  if (safeVolume <= 0) return 0;
  const safeArea = Math.max(0, Number.isFinite(openingAreaM2) ? openingAreaM2 : 0);
  const flowRate = DISCHARGE_COEFFICIENT * safeArea * CROSS_VENT_VELOCITY;
  return (flowRate * 3600) / safeVolume;
}

function equivalentOpeningArea(areaA, areaB) {
  const a = Math.max(0, Number.isFinite(areaA) ? areaA : 0);
  const b = Math.max(0, Number.isFinite(areaB) ? areaB : 0);
  if (a <= 1e-9 || b <= 1e-9) return 0;
  return 1 / Math.sqrt(1 / (a * a) + 1 / (b * b));
}

function pressureDrivenFlowRate(openingAreaM2, deltaPressurePa) {
  const area = Math.max(0, Number.isFinite(openingAreaM2) ? openingAreaM2 : 0);
  const pressure = Math.max(0, Number.isFinite(deltaPressurePa) ? deltaPressurePa : 0);
  if (area <= 1e-9 || pressure <= 1e-9) return 0;
  const theoreticalVelocity = Math.sqrt((2 * pressure) / RHO_AIR);
  const effectiveVelocity = Math.min(MAX_EFFECTIVE_OPENING_VELOCITY_MPS, theoreticalVelocity);
  return DISCHARGE_COEFFICIENT * area * effectiveVelocity;
}

export function calculateManualWindowVentilation(openedWindowArea, volume, options = {}) {
  const safeVolume = Math.max(0, Number.isFinite(volume) ? volume : 0);
  const byFace = openedWindowArea?.byFace ?? {};
  const roomHeightM = Math.max(
    0.1,
    Number.isFinite(options.roomHeightM) ? options.roomHeightM : BUILDING_HEIGHT,
  );
  const stackHeightM = Math.max(
    MIN_STACK_HEIGHT_M,
    Number.isFinite(options.stackHeightM) ? options.stackHeightM : roomHeightM * 0.65,
  );
  const windMS = Math.max(
    0,
    Number.isFinite(options.windMS) ? options.windMS : DEFAULT_SYNTHETIC_WIND_MS,
  );
  const effectiveWindMS = windMS * WIND_SPEED_SHELTER_FACTOR;
  const indoorTempC = Number.isFinite(options.indoorTempC) ? options.indoorTempC : 21;
  const outdoorTempC = Number.isFinite(options.outdoorTempC) ? options.outdoorTempC : indoorTempC;
  const roofOpeningAreaM2 = Math.max(
    0,
    Number.isFinite(options.roofOpeningAreaM2) ? options.roofOpeningAreaM2 : 0,
  );
  const windPressurePa = 0.5 * RHO_AIR * effectiveWindMS * effectiveWindMS;
  const meanAirTempK = Math.max(260, KELVIN_OFFSET + (indoorTempC + outdoorTempC) / 2);
  const stackPressurePa =
    RHO_AIR * GRAVITY_MPS2 * stackHeightM * (Math.abs(indoorTempC - outdoorTempC) / meanAirTempK);
  const areaByFace = FACES.reduce((acc, face) => {
    const area = byFace?.[face.id]?.openAreaM2;
    acc[face.id] = Math.max(0, Number.isFinite(area) ? area : 0);
    return acc;
  }, {});
  const totalOpenAreaM2 = FACES.reduce((sum, face) => sum + areaByFace[face.id], 0);
  const totalManualOpenAreaM2 = totalOpenAreaM2 + roofOpeningAreaM2;
  const openFaceIds = FACES.filter((face) => areaByFace[face.id] > 1e-6).map((face) => face.id);

  if (safeVolume <= 0 || totalManualOpenAreaM2 <= 1e-6) {
    return {
      mode: "none",
      modeLabel: "none",
      openFaceIds: [],
      totalOpenAreaM2: 0,
      totalManualOpenAreaM2: 0,
      roofOpeningAreaM2: 0,
      crossAreaM2: 0,
      residualAreaM2: 0,
      roofFlowM3s: 0,
      facadePressurePa: 0,
      roofPressurePa: 0,
      windMS,
      effectiveWindMS,
      windPressurePa,
      stackPressurePa,
      flowRateM3s: 0,
      manualOpenAchRaw: 0,
      manualOpenAch: 0,
      wasCapped: false,
      equivalentCrossAreaM2: 0,
      activeCrossPair: null,
    };
  }

  const nsCrossArea = equivalentOpeningArea(areaByFace.north, areaByFace.south);
  const ewCrossArea = equivalentOpeningArea(areaByFace.east, areaByFace.west);
  const hasCrossPair = nsCrossArea > 1e-6 || ewCrossArea > 1e-6;
  const crossAreaM2 = hasCrossPair ? Math.max(nsCrossArea, ewCrossArea) : 0;
  const activeCrossPair =
    crossAreaM2 <= 1e-6
      ? null
      : nsCrossArea >= ewCrossArea
        ? "north-south"
        : "east-west";

  let mode = "single-sided";
  let modeLabel = "single-sided";
  let facadeFlowRateM3s = 0;
  let residualAreaM2 = totalOpenAreaM2;
  let facadePressurePa = windPressurePa * PRESSURE_COEFF_SINGLE_SIDED;

  if (totalOpenAreaM2 <= 1e-6) {
    mode = "roof-only";
    modeLabel = "rooflight-only";
    residualAreaM2 = 0;
    facadePressurePa = 0;
  } else if (hasCrossPair && crossAreaM2 > 1e-6) {
    mode = "cross";
    modeLabel = "cross-ventilation";
    facadePressurePa = windPressurePa * PRESSURE_COEFF_CROSS;
    residualAreaM2 = Math.max(0, totalOpenAreaM2 - crossAreaM2 * 2);
    const crossFlow = pressureDrivenFlowRate(crossAreaM2, facadePressurePa);
    const residualFlow = pressureDrivenFlowRate(
      residualAreaM2,
      windPressurePa * PRESSURE_COEFF_SINGLE_SIDED,
    );
    facadeFlowRateM3s = crossFlow + residualFlow;
  } else if (openFaceIds.length >= 2) {
    mode = "multi-face";
    modeLabel = "multi-face";
    residualAreaM2 = totalOpenAreaM2;
    facadePressurePa = windPressurePa * PRESSURE_COEFF_MULTI_FACE;
    facadeFlowRateM3s = pressureDrivenFlowRate(totalOpenAreaM2, facadePressurePa);
  } else {
    facadeFlowRateM3s = pressureDrivenFlowRate(totalOpenAreaM2, facadePressurePa);
  }

  let roofPressurePa = 0;
  let roofFlowM3s = 0;
  if (roofOpeningAreaM2 > 1e-6) {
    if (totalOpenAreaM2 > 1e-6) {
      roofPressurePa =
        windPressurePa * PRESSURE_COEFF_ROOF_TO_FACADE + stackPressurePa;
      const roofEquivalentAreaM2 = equivalentOpeningArea(totalOpenAreaM2, roofOpeningAreaM2);
      roofFlowM3s = pressureDrivenFlowRate(roofEquivalentAreaM2, roofPressurePa);
    } else {
      const floorAreaM2 = safeVolume / roomHeightM;
      const makeUpAreaM2 = Math.max(MIN_MAKEUP_AREA_M2, floorAreaM2 * MAKEUP_AREA_RATIO_OF_FLOOR);
      roofPressurePa = windPressurePa * PRESSURE_COEFF_ROOF_ONLY + stackPressurePa;
      const roofOnlyEquivalentAreaM2 = equivalentOpeningArea(roofOpeningAreaM2, makeUpAreaM2);
      roofFlowM3s = pressureDrivenFlowRate(roofOnlyEquivalentAreaM2, roofPressurePa);
    }
  }

  const flowRateM3s =
    roofFlowM3s > 0 && facadeFlowRateM3s > 0
      ? Math.sqrt(facadeFlowRateM3s ** 2 + roofFlowM3s ** 2)
      : facadeFlowRateM3s + roofFlowM3s;
  const manualOpenAchRaw = (flowRateM3s * 3600) / safeVolume;
  const manualOpenAch = Number.isFinite(manualOpenAchRaw) ? Math.max(0, manualOpenAchRaw) : 0;
  const wasCapped = false;
  const equivalentCrossAreaM2 = crossAreaM2;

  return {
    mode,
    modeLabel,
    openFaceIds,
    totalOpenAreaM2,
    totalManualOpenAreaM2,
    roofOpeningAreaM2,
    crossAreaM2,
    residualAreaM2,
    roofFlowM3s,
    facadePressurePa,
    roofPressurePa,
    windMS,
    effectiveWindMS,
    windPressurePa,
    stackPressurePa,
    facadeFlowRateM3s,
    flowRateM3s,
    manualOpenAchRaw,
    manualOpenAch,
    wasCapped,
    equivalentCrossAreaM2,
    activeCrossPair,
  };
}

export function assessVentilationComfort({ achTotal, indoorTemp, outdoorTemp }) {
  const ach = Math.max(0, Number.isFinite(achTotal) ? achTotal : 0);
  const indoor = Number.isFinite(indoorTemp) ? indoorTemp : 0;
  const outdoor = Number.isFinite(outdoorTemp) ? outdoorTemp : indoor;
  const deltaT = indoor - outdoor;
  const achAboveBackground = Math.max(0, ach - ACH_INFILTRATION_DEFAULT);

  // Base draught cooling potential from airflow alone.
  const baseCoolingC =
    achAboveBackground <= 0.3
      ? 0
      : achAboveBackground <= 2
        ? (achAboveBackground - 0.3) * 0.18
        : 0.31 + (achAboveBackground - 2) * 0.24;

  // Cooler outdoor air increases discomfort; warmer outdoor air reduces it.
  const tempFactor =
    deltaT <= 0
      ? 0.25
      : Math.min(1.6, 0.35 + deltaT / 10);

  const apparentCoolingC = Math.min(3.5, Math.max(0, baseCoolingC * tempFactor));
  const perceivedTempC = indoor - apparentCoolingC;

  let risk = "low";
  let label = "Low draught risk";
  if (apparentCoolingC >= 1.5) {
    risk = "high";
    label = "High draught risk";
  } else if (apparentCoolingC >= 0.8) {
    risk = "moderate";
    label = "Moderate draught risk";
  } else if (apparentCoolingC >= 0.3) {
    risk = "slight";
    label = "Slight draught risk";
  }

  const isLikelyUncomfortable = apparentCoolingC >= 1;

  return {
    achTotal: ach,
    indoorTempC: indoor,
    outdoorTempC: outdoor,
    deltaTC: deltaT,
    apparentCoolingC,
    perceivedTempC,
    risk,
    label,
    isLikelyUncomfortable,
  };
}

/* -------------------- Helpers -------------------- */
export const deg2rad = (d) => (d * Math.PI) / 180;
export const rad2deg = (r) => (r * 180) / Math.PI;
export const lerp = (a, b, t) => a + (b - a) * t;
export const GBP_FORMAT = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 2,
});
export const formatGBP = (value) => GBP_FORMAT.format(Number.isFinite(value) ? value : 0);
export const formatPence = (value) =>
  `${((Number.isFinite(value) ? value : 0) * 100).toFixed(2)} p`;
export const formatKg = (value) => {
  if (!Number.isFinite(value)) return "0 kg CO2e";
  const abs = Math.abs(value);
  if (abs >= 100) return `${Math.round(value)} kg CO2e`;
  if (abs >= 10) return `${value.toFixed(1)} kg CO2e`;
  return `${value.toFixed(2)} kg CO2e`;
};

export function dayOfYearUTC(date) {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, date.getUTCMonth(), date.getUTCDate());
  return Math.floor((current - start) / (24 * 3600 * 1000)) + 1;
}

export function dateFromDayOfYearUTC(dayOfYear, year = MODEL_YEAR) {
  const clamped = Math.max(1, Math.min(DAYS_PER_YEAR, Math.round(dayOfYear)));
  return new Date(Date.UTC(year, 0, clamped));
}

export function localSolarHour(date, longitudeDeg = 0) {
  const utcHour =
    date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  return ((utcHour + longitudeDeg / 15) % 24 + 24) % 24;
}

export function formatClockTime(date) {
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function toSolarUtcDate(localStandardDate, tzHours = 0) {
  return new Date(localStandardDate.getTime() - tzHours * 3600 * 1000);
}

export function annualOutdoorPeakTemp(date, location) {
  const day = dayOfYearUTC(date);
  const summerPeak = location.temps.summer;
  const winterPeak = location.temps.winter;
  const annualMean = (summerPeak + winterPeak) / 2;
  const annualAmp = (summerPeak - winterPeak) / 2;
  const peakDay = location.latitude >= 0 ? SUMMER_SOLSTICE_DAY : WINTER_SOLSTICE_DAY;
  const phase = (2 * Math.PI * (day - peakDay)) / DAYS_PER_YEAR;
  return annualMean + annualAmp * Math.cos(phase);
}

export function outdoorTemperatureAt(date, location) {
  const dailyPeak = annualOutdoorPeakTemp(date, location);
  const diurnalAmp = (location.diurnalRange || 0) / 2;
  const diurnalMean = dailyPeak - diurnalAmp;
  const hour = localSolarHour(date, location.longitude);
  const phase = (2 * Math.PI * (hour - 15)) / 24;
  return diurnalMean + diurnalAmp * Math.cos(phase);
}

export function safeRadiation(value) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function computeCostCarbonSummary({
  heatingThermalKWh,
  coolingThermalKWh,
  days = 1,
  onSiteSolarKWh = 0,
  floorAreaM2 = BUILDING_WIDTH * BUILDING_DEPTH,
}) {
  const safeHeating = Number.isFinite(heatingThermalKWh) ? heatingThermalKWh : 0;
  const safeCooling = Number.isFinite(coolingThermalKWh) ? coolingThermalKWh : 0;
  const safeSolar = Math.max(0, Number.isFinite(onSiteSolarKWh) ? onSiteSolarKWh : 0);
  const safeFloorArea = Math.max(1, Number.isFinite(floorAreaM2) ? floorAreaM2 : BUILDING_WIDTH * BUILDING_DEPTH);

  // HVAC fuel consumption
  const heatingFuelKWh = safeHeating / Math.max(0.01, HEATING_SYSTEM.efficiency);
  const coolingFuelKWh = safeCooling / Math.max(0.01, COOLING_SYSTEM.cop);

  // Base electrical loads (lighting, small power, MVHR fans)
  const lightingKWh =
    (BASE_ELECTRICAL_LOADS.lighting.powerDensityWm2 * safeFloorArea *
      BASE_ELECTRICAL_LOADS.lighting.dailyHours * days) / 1000;
  const smallPowerKWh =
    (BASE_ELECTRICAL_LOADS.smallPower.powerDensityWm2 * safeFloorArea *
      BASE_ELECTRICAL_LOADS.smallPower.dailyHours * days) / 1000;
  const mvhrFansKWh =
    (BASE_ELECTRICAL_LOADS.mvhrFans.powerW *
      BASE_ELECTRICAL_LOADS.mvhrFans.dailyHours * days) / 1000;
  const baseElectricalKWh = lightingKWh + smallPowerKWh + mvhrFansKWh;

  // Total electricity demand (cooling + base electrical)
  const totalElectricityDemandKWh = coolingFuelKWh + baseElectricalKWh;

  // PV offsets on-site consumption first, then exports surplus
  const solarUsedOnSiteKWh = Math.min(totalElectricityDemandKWh, safeSolar);
  const solarExportedKWh = Math.max(0, safeSolar - totalElectricityDemandKWh);
  const gridElectricityKWh = Math.max(0, totalElectricityDemandKWh - solarUsedOnSiteKWh);

  // Energy costs
  const energyCostGross =
    heatingFuelKWh * ENERGY_TARIFFS.gas.unitRate +
    gridElectricityKWh * ENERGY_TARIFFS.electricity.unitRate;
  const exportRevenue = solarExportedKWh * ENERGY_TARIFFS.electricity.exportRate;
  const energyCost = energyCostGross - exportRevenue;
  const standingCost = INCLUDE_STANDING_CHARGES
    ? days *
      (ENERGY_TARIFFS.gas.standingChargePerDay +
        ENERGY_TARIFFS.electricity.standingChargePerDay)
    : 0;
  const totalCost = energyCost + standingCost;

  // Carbon accounting
  const grossCarbonKg =
    heatingFuelKWh * CARBON_FACTORS.gas.perKWh +
    gridElectricityKWh * CARBON_FACTORS.electricity.consumption;
  // Exported solar displaces grid electricity carbon
  const displacedCarbonKg = solarExportedKWh * CARBON_FACTORS.electricity.consumption;
  const carbonKg = grossCarbonKg - displacedCarbonKg;

  // Carbon intensity (kgCO₂e/m²/year) - LETI metric
  // For daily figures, annualize by multiplying by 365/days
  const annualizationFactor = 365 / Math.max(1, days);
  const carbonIntensityKgM2Year = (carbonKg * annualizationFactor) / safeFloorArea;
  const grossCarbonIntensityKgM2Year = (grossCarbonKg * annualizationFactor) / safeFloorArea;

  return {
    heatingThermalKWh: safeHeating,
    coolingThermalKWh: safeCooling,
    heatingFuelKWh,
    coolingFuelKWh,
    baseElectricalKWh,
    lightingKWh,
    smallPowerKWh,
    mvhrFansKWh,
    totalElectricityDemandKWh,
    onSiteSolarKWh: safeSolar,
    solarUsedOnSiteKWh,
    solarExportedKWh,
    gridElectricityKWh,
    energyCostGross,
    exportRevenue,
    energyCost,
    standingCost,
    totalCost,
    grossCarbonKg,
    displacedCarbonKg,
    carbonKg,
    carbonIntensityKgM2Year,
    grossCarbonIntensityKgM2Year,
    floorAreaM2: safeFloorArea,
  };
}

export function epwForcingAt(dateLocal, dataset) {
  const n = dataset?.hours?.length ?? 0;
  if (n !== 8760) return null;

  const tzHours = Number.isFinite(dataset?.meta?.tzHours) ? dataset.meta.tzHours : 0;
  const localStandard = new Date(dateLocal.getTime() + tzHours * 3600 * 1000);
  const dayIndex = dayOfYearUTC(localStandard) - 1;
  const hourFloat =
    localStandard.getUTCHours() +
    localStandard.getUTCMinutes() / 60 +
    localStandard.getUTCSeconds() / 3600;
  const baseHour = Math.floor(hourFloat);
  const frac = hourFloat - baseHour;

  const idx0 = ((dayIndex * 24 + baseHour) % n + n) % n;
  const idx1 = (idx0 + 1) % n;
  const h0 = dataset.hours[idx0];
  const h1 = dataset.hours[idx1];

  // Interpolate cloud cover (tenths, 0-10)
  const totalSkyCover =
    Number.isFinite(h0.totalSkyCover) && Number.isFinite(h1.totalSkyCover)
      ? lerp(h0.totalSkyCover, h1.totalSkyCover, frac)
      : undefined;

  return {
    T_out: lerp(h0.tDryC, h1.tDryC, frac),
    DNI: safeRadiation(lerp(h0.dniWhm2, h1.dniWhm2, frac)),
    DHI: safeRadiation(lerp(h0.dhiWhm2, h1.dhiWhm2, frac)),
    GHI: safeRadiation(lerp(h0.ghiWhm2, h1.ghiWhm2, frac)),
    windMS:
      Number.isFinite(h0.windMS) && Number.isFinite(h1.windMS)
        ? lerp(h0.windMS, h1.windMS, frac)
        : undefined,
    totalSkyCover,
  };
}

export function syntheticWindSpeedAt(dateLocal, profile = SYNTHETIC_PROFILE) {
  const hour = localSolarHour(dateLocal, profile.longitude);
  const day = dayOfYearUTC(dateLocal);
  const meanWindMS = Number.isFinite(profile?.meanWindMS)
    ? profile.meanWindMS
    : DEFAULT_SYNTHETIC_WIND_MS;
  // Daytime breezes are usually stronger; winter tends to be windier than summer.
  const diurnalBoost = Math.max(0, Math.sin(((hour - 6) * Math.PI) / 12));
  const seasonalBoost = Math.cos((2 * Math.PI * (day - WINTER_SOLSTICE_DAY)) / DAYS_PER_YEAR);
  const windMS = meanWindMS + 0.7 * diurnalBoost + 0.5 * seasonalBoost;
  return Math.max(0.3, Math.min(12, windMS));
}

function syntheticRadiationAt(dateLocal, profile, totalSkyCover) {
  const latitude = Number.isFinite(profile?.latitude) ? profile.latitude : SYNTHETIC_PROFILE.latitude;
  const longitude = Number.isFinite(profile?.longitude) ? profile.longitude : SYNTHETIC_PROFILE.longitude;
  const tzHours = Number.isFinite(profile?.tzHours) ? profile.tzHours : SYNTHETIC_PROFILE.tzHours;
  const solarDateUtc = toSolarUtcDate(dateLocal, tzHours);
  const { altitude } = solarPosition(solarDateUtc, latitude, longitude);
  const clearSky = skyGroundComponents(altitude);
  if (altitude <= 0) {
    return { DNI: 0, DHI: 0, GHI: 0 };
  }

  const cloudTenths = Number.isFinite(totalSkyCover)
    ? Math.max(0, Math.min(10, totalSkyCover))
    : null;
  if (cloudTenths === null) {
    return {
      DNI: safeRadiation(clearSky.DNI),
      DHI: safeRadiation(clearSky.DHI),
      GHI: safeRadiation(clearSky.GHI),
    };
  }

  const cloudFraction = cloudTenths / 10;
  const beamFactor = Math.max(0.08, 1 - 0.8 * cloudFraction ** 1.4);
  const diffuseFactor = 0.65 + cloudFraction * 0.9;
  const dni = safeRadiation(clearSky.DNI * beamFactor);
  const dhi = safeRadiation(clearSky.DHI * diffuseFactor);
  const ghi = safeRadiation(
    dni * Math.max(0, Math.sin(deg2rad(altitude))) + dhi,
  );
  return { DNI: dni, DHI: dhi, GHI: ghi };
}

export function forcingAt(dateLocal, provider) {
  const syntheticProfile = provider?.syntheticProfile || SYNTHETIC_PROFILE;
  const fallbackWindMS = syntheticWindSpeedAt(
    dateLocal,
    syntheticProfile,
  );
  if (provider?.mode === "epw" && provider.dataset) {
    const epw = epwForcingAt(dateLocal, provider.dataset);
    if (epw) {
      return {
        ...epw,
        windMS: Number.isFinite(epw.windMS) ? epw.windMS : fallbackWindMS,
        source: "epw",
      };
    }
  }

  const T_out = outdoorTemperatureAt(dateLocal, syntheticProfile);
  const syntheticSource =
    typeof provider?.syntheticSource === "string" && provider.syntheticSource.length > 0
      ? provider.syntheticSource
      : "synthetic";
  const totalSkyCover = Number.isFinite(provider?.totalSkyCover)
    ? Math.max(0, Math.min(10, provider.totalSkyCover))
    : Number.isFinite(syntheticProfile?.cloudCoverTenths)
      ? Math.max(0, Math.min(10, syntheticProfile.cloudCoverTenths))
      : undefined;
  const relativeHumidity = Number.isFinite(provider?.relativeHumidity)
    ? Math.max(0, Math.min(100, provider.relativeHumidity))
    : Number.isFinite(syntheticProfile?.humidityPct)
      ? Math.max(0, Math.min(100, syntheticProfile.humidityPct))
      : undefined;
  const syntheticRadiation = syntheticRadiationAt(dateLocal, syntheticProfile, totalSkyCover);
  return {
    T_out,
    windMS: fallbackWindMS,
    totalSkyCover,
    relativeHumidity,
    source: syntheticSource,
    ...syntheticRadiation,
  };
}

export function isNightHour(hour) {
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

export function uValuePresetLabel(presetId) {
  const preset = U_VALUE_PRESETS[presetId] ?? U_VALUE_PRESETS[DEFAULT_U_VALUE_PRESET];
  return preset.label;
}

export function ventilationPresetLabel(presetId) {
  const preset =
    VENTILATION_PRESETS[presetId] ?? VENTILATION_PRESETS[DEFAULT_VENTILATION_PRESET];
  return preset.label;
}

export function ventilationStateForStep({
  achTotal = ACH_INFILTRATION_DEFAULT,
  hourOfDay = 12,
  nightPurgeEnabled = false,
}) {
  const purgeTotal = VENTILATION_PRESETS.purge?.achTotal ?? achTotal;
  const targetTotal =
    nightPurgeEnabled && isNightHour(hourOfDay) ? Math.max(achTotal, purgeTotal) : achTotal;
  const safeTotal = Math.max(ACH_INFILTRATION_DEFAULT, targetTotal);
  const achWindow = Math.max(0, safeTotal - ACH_INFILTRATION_DEFAULT);
  const ventActive = achWindow > 0;
  return { ventActive, achWindow, achTotal: safeTotal };
}

export function adaptiveVentilationStateForStep({
  indoorTemp,
  outdoorTemp,
  hourOfDay = 12,
  comfortBand = COMFORT_BAND,
  config = ADAPTIVE_VENTILATION_CONFIG,
}) {
  const { nightFloorTemp, minBenefitDelta, overheatScaleMax, achRange } = config;
  const isNight = isNightHour(hourOfDay);
  const overheatDelta = indoorTemp - comfortBand.max;
  const coolingBenefit = indoorTemp - outdoorTemp;
  const ventilationHelpful = overheatDelta > 0 && coolingBenefit >= minBenefitDelta;

  let targetAch = ACH_INFILTRATION_DEFAULT;
  let adaptiveReason = "comfortable";

  if (ventilationHelpful) {
    if (isNight && indoorTemp <= nightFloorTemp) {
      targetAch = ACH_INFILTRATION_DEFAULT;
      adaptiveReason = "night-floor";
    } else {
      const scale = Math.min(1, Math.max(0, overheatDelta / overheatScaleMax));
      targetAch = achRange.min + scale * (achRange.max - achRange.min);
      adaptiveReason = isNight ? "night-cooling" : "day-cooling";
    }
  } else if (overheatDelta > 0) {
    targetAch = ACH_INFILTRATION_DEFAULT;
    adaptiveReason = "outdoor-warm";
  }

  const safeTotal = Math.max(ACH_INFILTRATION_DEFAULT, targetAch);
  const achWindow = Math.max(0, safeTotal - ACH_INFILTRATION_DEFAULT);
  const ventActive = achWindow > 0;

  return { ventActive, achWindow, achTotal: safeTotal, adaptiveReason };
}

function isHourInRange(hourOfDay, startHour, endHour) {
  const hour = ((Math.floor(hourOfDay) % 24) + 24) % 24;
  const start = ((Math.floor(startHour) % 24) + 24) % 24;
  const end = ((Math.floor(endHour) % 24) + 24) % 24;
  if (start === end) return true;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function mvhrVentilationStateForStep({
  indoorTemp,
  outdoorTemp,
  hourOfDay = 12,
  baseAch = VENTILATION_PRESETS.passivhaus?.achTotal ?? 0.4,
  comfortBand = COMFORT_BAND,
  config = MVHR_CONTROL_CONFIG,
}) {
  const safeBase = Math.max(ACH_INFILTRATION_DEFAULT, Number.isFinite(baseAch) ? baseAch : ACH_INFILTRATION_DEFAULT);
  const occupiedMorning = isHourInRange(
    hourOfDay,
    config.occupiedMorningStartHour,
    config.occupiedMorningEndHour,
  );
  const occupiedEvening = isHourInRange(
    hourOfDay,
    config.occupiedEveningStartHour,
    config.occupiedEveningEndHour,
  );
  const occupiedPeriod = occupiedMorning || occupiedEvening;
  const coolingNeeded = indoorTemp > comfortBand.max;
  const outdoorCanCool = outdoorTemp <= indoorTemp - config.bypassBenefitDeltaC;
  const mvhrBypassActive = coolingNeeded && outdoorCanCool;

  let targetAch = safeBase;
  let mvhrMode = "base";

  if (mvhrBypassActive) {
    targetAch = Math.max(safeBase, config.summerBoostAch);
    mvhrMode = "summer-bypass";
  } else if (occupiedPeriod) {
    targetAch = Math.max(safeBase, config.boostAch);
    mvhrMode = "boost";
  }

  const achTotal = Math.max(ACH_INFILTRATION_DEFAULT, targetAch);
  const achWindow = Math.max(0, achTotal - ACH_INFILTRATION_DEFAULT);
  const ventActive = achWindow > 0;

  return { ventActive, achWindow, achTotal, mvhrMode, mvhrBypassActive };
}

export function validateEpwDataset(dataset) {
  const tVals = dataset.hours.map((h) => h.tDryC).filter(Number.isFinite);
  const ghiVals = dataset.hours.map((h) => h.ghiWhm2).filter(Number.isFinite);
  const stats = {
    tMin: Math.min(...tVals),
    tMax: Math.max(...tVals),
    ghiMin: Math.min(...ghiVals),
    ghiMax: Math.max(...ghiVals),
  };

  const januaryRows = dataset.hours.slice(0, 31 * 24);
  const julyStart = (182 - 1) * 24;
  const julyRows = dataset.hours.slice(julyStart, julyStart + 31 * 24);
  const mean = (arr, pick) => arr.reduce((acc, row) => acc + pick(row), 0) / (arr.length || 1);
  const janMean = mean(januaryRows, (row) => row.tDryC);
  const julMean = mean(julyRows, (row) => row.tDryC);

  const midsummerStart = (SUMMER_SOLSTICE_DAY - 1) * 24;
  const midsummerDay = dataset.hours.slice(midsummerStart, midsummerStart + 24);
  const peak = midsummerDay.reduce(
    (best, row, idx) =>
      row.ghiWhm2 > best.ghiWhm2 ? { hour: idx, ghiWhm2: row.ghiWhm2 } : best,
    { hour: 0, ghiWhm2: -1 },
  );

  const seasonalCheckPass = janMean < julMean;
  const middayPeakPass = peak.hour >= 10 && peak.hour <= 15;

  return { stats, janMean, julMean, peak, seasonalCheckPass, middayPeakPass };
}

export function normalizedAzimuth(azimuthDeg) {
  return ((azimuthDeg % 360) + 360) % 360;
}

export function ratioToDepthMeters(ratio, buildingHeight = BUILDING_HEIGHT) {
  return Math.max(0, Math.min(1, ratio || 0)) * buildingHeight;
}

export const MIN_WINDOW_CLEAR_HEIGHT = 0.4;
const EXTERNAL_SHADING_PROJECTION_M = 0.3; // 300 mm projection for fins/louvers

export function resolveWindowOpeningHeight(
  openingHeight,
  cillLift = 0,
  headDrop = 0,
  minClearHeight = MIN_WINDOW_CLEAR_HEIGHT,
) {
  const safeOpeningHeight = Math.max(0, openingHeight);
  const safeMinClear = Math.max(0, minClearHeight);
  const maxOffset = Math.max(0, safeOpeningHeight - safeMinClear);
  const safeCillLift = Math.max(0, Math.min(cillLift ?? 0, maxOffset));
  const maxHeadDrop = Math.max(0, safeOpeningHeight - safeCillLift - safeMinClear);
  const safeHeadDrop = Math.max(0, Math.min(headDrop ?? 0, maxHeadDrop));
  const effectiveHeight = Math.max(0, safeOpeningHeight - safeCillLift - safeHeadDrop);
  return {
    cillLift: safeCillLift,
    headDrop: safeHeadDrop,
    effectiveHeight,
  };
}

export function clampWindowCenterRatio(glazingRatio, centerRatio = 0) {
  const glazing = Math.max(0, Math.min(0.8, glazingRatio || 0));
  const maxRatio = Math.max(0, 1 - glazing);
  const safeCenter = Number.isFinite(centerRatio) ? centerRatio : 0;
  return Math.max(-maxRatio, Math.min(maxRatio, safeCenter));
}

function operableLeafGeometry(faceSpan, glazingRatio, roomHeight, cillLift = 0, headDrop = 0) {
  const glazing = Math.max(0, Math.min(0.8, glazingRatio || 0));
  if (glazing <= 0.001) return null;

  const opening = resolveWindowOpeningHeight(roomHeight, cillLift, headDrop);
  const windowHeight = opening.effectiveHeight;
  if (windowHeight <= 0.001) return null;

  const windowWidth = faceSpan * glazing;
  const outerFrameProfile = Math.min(
    WINDOW_FRAME_PROFILE,
    windowWidth * 0.45,
    windowHeight * 0.45,
  );
  const clearOpeningWidth = Math.max(0.02, windowWidth - outerFrameProfile * 2);
  const clearOpeningHeight = Math.max(0.02, windowHeight - outerFrameProfile * 2);
  const leafCount = Math.max(1, Math.ceil(clearOpeningWidth / MAX_WINDOW_LEAF_WIDTH_M));
  const mullionWidth = leafCount > 1 ? outerFrameProfile : 0;
  const leafWidth = Math.max(
    0.02,
    (clearOpeningWidth - mullionWidth * (leafCount - 1)) / leafCount,
  );
  const effectiveOpenTravel = Math.min(WINDOW_OPEN_TRAVEL_M, clearOpeningHeight);
  const topHungOpeningAreaPerLeaf = Math.max(
    0,
    leafWidth * effectiveOpenTravel * TOP_HUNG_OPENING_EFFECTIVENESS,
  );
  const turnOpeningAreaPerLeaf = Math.max(
    0,
    leafWidth * clearOpeningHeight * TURN_OPENING_EFFECTIVENESS,
  );

  return {
    leafCount,
    topHungOpeningAreaPerLeaf,
    turnOpeningAreaPerLeaf,
    openingAreaTotal:
      Math.max(topHungOpeningAreaPerLeaf, turnOpeningAreaPerLeaf) * leafCount,
  };
}

export function calculateOpenedWindowArea(faceState, dimensions = {}, openWindowSegments = {}) {
  const width = Number.isFinite(dimensions.width) ? dimensions.width : BUILDING_WIDTH;
  const depth = Number.isFinite(dimensions.depth) ? dimensions.depth : BUILDING_DEPTH;
  const height = Number.isFinite(dimensions.height) ? dimensions.height : BUILDING_HEIGHT;
  const byFace = {};
  let totalOpenAreaM2 = 0;
  let topHungAreaM2 = 0;
  let turnAreaM2 = 0;
  let openLeafCount = 0;
  let topHungLeafCount = 0;
  let turnLeafCount = 0;
  let totalLeafCount = 0;

  FACES.forEach((face) => {
    const config = faceState?.[face.id];
    const faceSpan = face.id === "east" || face.id === "west" ? depth : width;
    const geometry = operableLeafGeometry(
      faceSpan,
      config?.glazing,
      height,
      config?.cillLift,
      config?.headDrop,
    );
    if (!geometry) {
      byFace[face.id] = {
        openAreaM2: 0,
        topHungAreaM2: 0,
        turnAreaM2: 0,
        openLeafCount: 0,
        topHungLeafCount: 0,
        turnLeafCount: 0,
        totalLeafCount: 0,
      };
      return;
    }

    let faceOpenLeafCount = 0;
    let faceTopHungLeafCount = 0;
    let faceTurnLeafCount = 0;
    let faceOpenArea = 0;
    let faceTopHungArea = 0;
    let faceTurnArea = 0;
    for (let leafIndex = 0; leafIndex < geometry.leafCount; leafIndex += 1) {
      const key = `${face.id}:${leafIndex}`;
      const leafState = normalizeWindowSegmentState(openWindowSegments?.[key]);
      if (leafState === WINDOW_SEGMENT_STATE.TOP_HUNG) {
        faceOpenLeafCount += 1;
        faceTopHungLeafCount += 1;
        faceOpenArea += geometry.topHungOpeningAreaPerLeaf;
        faceTopHungArea += geometry.topHungOpeningAreaPerLeaf;
      } else if (leafState === WINDOW_SEGMENT_STATE.TURN) {
        faceOpenLeafCount += 1;
        faceTurnLeafCount += 1;
        faceOpenArea += geometry.turnOpeningAreaPerLeaf;
        faceTurnArea += geometry.turnOpeningAreaPerLeaf;
      }
    }

    byFace[face.id] = {
      openAreaM2: faceOpenArea,
      topHungAreaM2: faceTopHungArea,
      turnAreaM2: faceTurnArea,
      openLeafCount: faceOpenLeafCount,
      topHungLeafCount: faceTopHungLeafCount,
      turnLeafCount: faceTurnLeafCount,
      totalLeafCount: geometry.leafCount,
    };
    totalOpenAreaM2 += faceOpenArea;
    topHungAreaM2 += faceTopHungArea;
    turnAreaM2 += faceTurnArea;
    openLeafCount += faceOpenLeafCount;
    topHungLeafCount += faceTopHungLeafCount;
    turnLeafCount += faceTurnLeafCount;
    totalLeafCount += geometry.leafCount;
  });

  return {
    totalOpenAreaM2,
    topHungAreaM2,
    turnAreaM2,
    openLeafCount,
    topHungLeafCount,
    turnLeafCount,
    totalLeafCount,
    byFace,
  };
}

export function buildWindowsFromFaceState(
  faceState,
  orientationDeg = 0,
  dimensions = {}
) {
  const width = Number.isFinite(dimensions.width) ? dimensions.width : BUILDING_WIDTH;
  const depth = Number.isFinite(dimensions.depth) ? dimensions.depth : BUILDING_DEPTH;
  const height = Number.isFinite(dimensions.height) ? dimensions.height : BUILDING_HEIGHT;
  return FACES.map((face) => {
    const config = faceState[face.id];
    if (!config || config.glazing <= 0) return null;
    const glazing = Math.max(0, Math.min(0.8, config.glazing));
    const faceSpan = face.id === "east" || face.id === "west" ? depth : width;
    const opening = resolveWindowOpeningHeight(height, config.cillLift, config.headDrop);
    if (opening.effectiveHeight <= 0.001) return null;
    return {
      w: faceSpan * glazing,
      h: opening.effectiveHeight,
      az: normalizedAzimuth(face.azimuth + orientationDeg),
      overhangDepth: Math.max(0, Math.min(1.5, config.overhang || 0)),
      finDepth: ratioToDepthMeters(config.fin, height),
      hFinDepth: ratioToDepthMeters(config.hFin, height),
    };
  }).filter(Boolean);
}

export function buildPreviewFaceConfigs(faceState, dimensions = {}) {
  const height = Number.isFinite(dimensions.height) ? dimensions.height : BUILDING_HEIGHT;
  return FACES.reduce((acc, face) => {
    const config = faceState[face.id] || {
      glazing: 0,
      overhang: 0,
      fin: 0,
      hFin: 0,
      cillLift: 0,
      headDrop: 0,
      windowCenterRatio: 0,
    };
    const glazing = Math.max(0, Math.min(0.8, config.glazing));
    acc[face.id] = {
      glazing,
      overhang: Math.max(0, Math.min(1.5, config.overhang || 0)),
      fin: ratioToDepthMeters(config.fin, height),
      hFin: ratioToDepthMeters(config.hFin, height),
      windowCenterRatio: clampWindowCenterRatio(glazing, config.windowCenterRatio ?? 0),
      ...resolveWindowOpeningHeight(height, config.cillLift, config.headDrop),
    };
    return acc;
  }, {});
}

export function cloneFaceState(faceState) {
  return FACES.reduce((acc, face) => {
    acc[face.id] = {
      glazing: faceState[face.id]?.glazing ?? 0,
      overhang: faceState[face.id]?.overhang ?? 0,
      fin: faceState[face.id]?.fin ?? 0,
      hFin: faceState[face.id]?.hFin ?? 0,
      cillLift: faceState[face.id]?.cillLift ?? 0,
      headDrop: faceState[face.id]?.headDrop ?? 0,
      windowCenterRatio: faceState[face.id]?.windowCenterRatio ?? 0,
    };
    return acc;
  }, {});
}

export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function dateFromTypicalYearHour(hourIndex) {
  const wrapped = ((hourIndex % 8760) + 8760) % 8760;
  return new Date(Date.UTC(MODEL_YEAR, 0, 1, wrapped, 0, 0));
}

export function formatHourRange(hour) {
  const start = ((hour % 24) + 24) % 24;
  const end = (start + 1) % 24;
  const fmt = (h) => {
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:00`;
  };
  const startPeriod = start >= 12 ? "pm" : "am";
  const endPeriod = end >= 12 ? "pm" : "am";
  if (startPeriod === endPeriod) {
    return `${fmt(start)} - ${fmt(end)}${endPeriod}`;
  }
  return `${fmt(start)}${startPeriod} - ${fmt(end)}${endPeriod}`;
}

export function formatMonthDayTime(date) {
  return `${MONTH_SHORT[date.getUTCMonth()]} ${date.getUTCDate()} ${formatClockTime(date)}`;
}

export function formatMonthDay(date) {
  return `${MONTH_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export function buildTemperatureHistogram(temperatures) {
  const bins = [
    { label: "<16°C", min: -Infinity, max: 16 },
    { label: "16-18°C", min: 16, max: 18 },
    { label: "18-20°C", min: 18, max: 20 },
    { label: "20-22°C", min: 20, max: 22 },
    { label: "22-24°C", min: 22, max: 24 },
    { label: "24-26°C", min: 24, max: 26 },
    { label: "26-28°C", min: 26, max: 28 },
    { label: "28-30°C", min: 28, max: 30 },
    { label: ">30°C", min: 30, max: Infinity },
  ];
  const counts = bins.map(() => 0);
  temperatures.forEach((temp) => {
    const idx = bins.findIndex((bin) => temp >= bin.min && temp < bin.max);
    if (idx >= 0) counts[idx] += 1;
  });
  return bins.map((bin, idx) => ({ band: bin.label, hours: counts[idx] }));
}

export function solarPosition(date, latitudeDeg, longitudeDeg = 0) {
  const lat = deg2rad(latitudeDeg);
  const d = date;
  const time = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  let yyyy = d.getUTCFullYear();
  let mm = d.getUTCMonth() + 1;
  const dd = d.getUTCDate();
  if (mm <= 2) {
    yyyy -= 1;
    mm += 12;
  }
  const A = Math.floor(yyyy / 100);
  const B = 2 - A + Math.floor(A / 4);
  const JD =
    Math.floor(365.25 * (yyyy + 4716)) +
    Math.floor(30.6001 * (mm + 1)) +
    dd +
    B -
    1524.5 +
    time / 24;
  const n = JD - 2451545.0;

  const L = ((280.46 + 0.9856474 * n) % 360 + 360) % 360;
  const g = deg2rad(((357.528 + 0.9856003 * n) % 360 + 360) % 360);
  const lambda =
    deg2rad(((L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) % 360 + 360) % 360);
  const epsilon = deg2rad(23.439 - 0.0000004 * n);

  const sinDec = Math.sin(epsilon) * Math.sin(lambda);
  const cosDec = Math.sqrt(1 - sinDec * sinDec);

  const GMST = ((18.697374558 + 24.06570982441908 * n) % 24 + 24) % 24;
  const LST = ((GMST + longitudeDeg / 15) % 24 + 24) % 24;
  const H = deg2rad(
    ((LST * 15) -
      rad2deg(Math.atan2(Math.sin(lambda) * Math.cos(epsilon), Math.cos(lambda)))) % 360,
  );

  const altitude = Math.asin(Math.sin(lat) * sinDec + Math.cos(lat) * cosDec * Math.cos(H));
  const azimuth = Math.atan2(
    -Math.sin(H) * cosDec,
    Math.cos(lat) * sinDec - Math.sin(lat) * cosDec * Math.cos(H),
  );

  return {
    altitude: rad2deg(altitude),
    azimuth: (rad2deg(azimuth) + 360) % 360,
    declination: rad2deg(Math.asin(sinDec)),
  };
}

export function clearSkyBeamNormal(altitudeDeg) {
  if (altitudeDeg <= 0) return 0;
  const m = 1 / Math.sin(deg2rad(altitudeDeg));
  const I0 = 1000;
  const tau = 0.75;
  return I0 * Math.pow(tau, m);
}

export function skyGroundComponents(altitudeDeg) {
  if (altitudeDeg <= 0) return { DNI: 0, GHI: 0, DHI: 0 };
  const sinAlt = Math.sin(deg2rad(altitudeDeg));
  const DNI = clearSkyBeamNormal(altitudeDeg);
  const DHI = 100 * sinAlt;
  const GHI = Math.max(0, DNI * sinAlt + DHI);
  return { DNI, GHI, DHI };
}

export function profileAngle(altDeg, azimuthDeg, surfaceAzimuthDeg) {
  const dAz = deg2rad(Math.abs(((azimuthDeg - surfaceAzimuthDeg + 540) % 360) - 180));
  const t = Math.tan(deg2rad(altDeg)) / Math.cos(dAz);
  return rad2deg(Math.atan(t));
}

export function overhangShadingFraction(windowH, depth_m, altDeg, azimuthDeg, surfaceAzimuthDeg) {
  if (depth_m <= 0 || altDeg <= 0) return 0;
  const phi = profileAngle(altDeg, azimuthDeg, surfaceAzimuthDeg);
  const L = depth_m * Math.tan(deg2rad(phi));
  if (!isFinite(L) || L <= 0) return 0;
  return Math.max(0, Math.min(1, L / windowH));
}

export function finsShadingFraction(windowH, finDepth_m, azimuthDeg, surfaceAzimuthDeg, overhangDepth = 0, altitudeDeg = 45) {
  if (finDepth_m <= 0) return 0;

  // Check if sun is hitting this surface (within ±90° of surface normal)
  const dAzDeg = ((azimuthDeg - surfaceAzimuthDeg + 540) % 360) - 180;
  if (Math.abs(dAzDeg) >= 90) return 0; // Sun is behind this surface

  // Brise-soleil geometry: fins at regular intervals with fixed projection
  // These values match the visual rendering in BuildingPreview.jsx/WallFace.jsx
  const FIN_PROJECTION = EXTERNAL_SHADING_PROJECTION_M;
  const MIN_GAP = 0.1; // 10cm spacing (dense) - matches rendering
  const MAX_GAP = 0.6; // 60cm spacing (sparse) - matches rendering

  // finDepth_m is actually a ratio encoded as meters (0 to ~2.6m)
  // Convert back to 0-1 ratio to calculate gap
  const ratio = Math.min(1, finDepth_m / Math.max(0.001, windowH));
  const effectiveRatio = Math.max(0, Math.min(1, ratio));
  const gap = MAX_GAP - effectiveRatio * (MAX_GAP - MIN_GAP);

  // Calculate shadow width from each fin based on sun angle
  const dAz = deg2rad(dAzDeg);
  const shadowWidth = Math.abs(FIN_PROJECTION * Math.tan(dAz));

  // Base shading fraction is the ratio of shadow width to gap between fins
  let shadingFraction = shadowWidth / gap;

  // When fins are at overhang position (> 1m from face), they move out between columns
  // Account for shadow geometry - shadows must travel further to reach the window
  if (overhangDepth > 1) {
    // Actual distance from fins to window plane (accounting for fin projection)
    const distanceFromWindow = overhangDepth - FIN_PROJECTION / 2;

    // At low altitudes, shadows from distant fins may fall below the window
    // Shadow drop over distance = distance / tan(altitude)
    const altRad = deg2rad(Math.max(5, altitudeDeg));
    const shadowDrop = distanceFromWindow / Math.tan(altRad);

    // Reduce effectiveness proportionally based on how much shadow misses the window
    // At 1.5m overhang (max), shadow drop is significant at low sun angles
    const dropFactor = Math.max(0, 1 - shadowDrop / (windowH * 1.5));
    shadingFraction *= dropFactor;
  }

  return Math.max(0, Math.min(1, shadingFraction));
}

export function horizontalFinsShadingFraction(windowH, hFinDepth_m, altDeg, azimuthDeg, surfaceAzimuthDeg, overhangDepth = 0) {
  if (hFinDepth_m <= 0 || altDeg <= 0) return 0;

  // Check if sun is hitting this surface (within ±90° of surface normal)
  const dAzDeg = ((azimuthDeg - surfaceAzimuthDeg + 540) % 360) - 180;
  if (Math.abs(dAzDeg) >= 90) return 0; // Sun is behind this surface

  // Horizontal louver geometry: slats at regular intervals with fixed projection
  // These values match the visual rendering in BuildingPreview.jsx/WallFace.jsx
  const SLAT_PROJECTION = EXTERNAL_SHADING_PROJECTION_M;
  const MIN_GAP = 0.1; // 10cm spacing (dense) - matches rendering
  const MAX_GAP = 0.6; // 60cm spacing (sparse) - matches rendering

  // hFinDepth_m is a ratio encoded as meters (0 to ~2.6m)
  // Convert back to 0-1 ratio to calculate gap
  const ratio = Math.min(1, hFinDepth_m / Math.max(0.001, windowH));
  const effectiveRatio = Math.max(0, Math.min(1, ratio));
  const gap = MAX_GAP - effectiveRatio * (MAX_GAP - MIN_GAP);

  // Calculate shadow depth from each slat based on profile angle (sun altitude relative to surface)
  const phi = profileAngle(altDeg, azimuthDeg, surfaceAzimuthDeg);
  if (phi <= 0) return 0;
  const shadowDepth = SLAT_PROJECTION * Math.tan(deg2rad(phi));

  // Base shading fraction is the ratio of shadow depth to gap between slats
  let shadingFraction = shadowDepth / gap;

  // When louvres are at overhang position (> 1m from face), they move out between columns
  // Account for shadow geometry - shadows must travel further to reach the window
  if (overhangDepth > 1) {
    // Actual distance from louvres to window plane (accounting for slat projection)
    const distanceFromWindow = overhangDepth - SLAT_PROJECTION / 2;

    // At low profile angles, shadows from distant louvres may fall in front of window
    // Shadow vertical drop over horizontal distance = distance / tan(profile angle)
    const phiRad = deg2rad(Math.max(5, phi));
    const shadowDrop = distanceFromWindow / Math.tan(phiRad);

    // Reduce effectiveness proportionally based on how much shadow misses the window
    // At 1.5m overhang (max), shadow drop is significant at low profile angles
    const dropFactor = Math.max(0, 1 - shadowDrop / (windowH * 1.5));
    shadingFraction *= dropFactor;
  }

  return Math.max(0, Math.min(1, shadingFraction));
}

export function cardinalFromAzimuth(azimuthDeg) {
  if (typeof azimuthDeg !== "number" || Number.isNaN(azimuthDeg)) return null;
  const az = ((azimuthDeg % 360) + 360) % 360;
  if (az < 45 || az >= 315) return "north";
  if (az < 135) return "east";
  if (az < 225) return "south";
  return "west";
}

export function planeIrradianceVertical({
  surfaceAzimuthDeg,
  altitudeDeg,
  azimuthDeg,
  DNI,
  DHI,
  GHI,
  groundAlbedo = 0.2,
}) {
  const dAz = deg2rad(Math.abs(((azimuthDeg - surfaceAzimuthDeg + 540) % 360) - 180));
  const cosTheta = Math.max(0, Math.cos(deg2rad(altitudeDeg)) * Math.cos(dAz));
  const I_beam = DNI * cosTheta;
  const I_diff = 0.5 * DHI;
  const I_gnd = 0.5 * GHI * groundAlbedo;
  return { I_beam, I_diff, I_gnd };
}

export function planeIrradianceHorizontalUp({
  altitudeDeg,
  DNI,
  DHI,
}) {
  if (altitudeDeg <= 0) {
    return { I_beam: 0, I_diff: 0, I_gnd: 0 };
  }
  const sinAlt = Math.max(0, Math.sin(deg2rad(altitudeDeg)));
  const I_beam = DNI * sinAlt;
  const I_diff = DHI;
  const I_gnd = 0;
  return { I_beam, I_diff, I_gnd };
}

export function planeIrradianceTilted({
  tiltDeg = 0,
  surfaceAzimuthDeg = 180,
  altitudeDeg,
  azimuthDeg,
  DNI,
  DHI,
  GHI,
  groundAlbedo = 0.2,
}) {
  const beta = deg2rad(Math.max(0, Math.min(90, Number.isFinite(tiltDeg) ? tiltDeg : 0)));
  const alt = deg2rad(Number.isFinite(altitudeDeg) ? altitudeDeg : 0);
  const azDiff = deg2rad(
    Math.abs(((Number(azimuthDeg) - Number(surfaceAzimuthDeg) + 540) % 360) - 180),
  );
  const cosTheta =
    Math.sin(alt) * Math.cos(beta) +
    Math.cos(alt) * Math.sin(beta) * Math.cos(azDiff);
  const I_beam = Math.max(0, Number(DNI) || 0) * Math.max(0, cosTheta);
  const I_diff = Math.max(0, Number(DHI) || 0) * ((1 + Math.cos(beta)) / 2);
  const I_gnd =
    Math.max(0, Number(GHI) || 0) * Math.max(0, Number(groundAlbedo) || 0) * ((1 - Math.cos(beta)) / 2);
  return { I_beam, I_diff, I_gnd };
}

/* -------------------- Thermal engine -------------------- */
export function computeSnapshot(params) {
  const {
    width,
    depth,
    height,
    U_wall,
    U_window,
    U_roof,
    U_floor,
    windows,
    autoBlinds,
    blindsThreshold,
    blindsReduction,
    g_glass,
    achTotal = ACH_INFILTRATION_DEFAULT,
    heatRecoveryEfficiency = 0,
    T_out,
    Q_internal,
    latitude,
    longitude,
    dateMidday,
    groundAlbedo,
    T_room_override,
    weatherRadiation,
    timezoneHours = 0,
    rooflight,
  } = params;

  const volume = width * depth * height;
  const hrEff = Math.max(0, Math.min(1, heatRecoveryEfficiency || 0));
  const UA_vent = ((RHO_AIR * CP_AIR * achTotal * volume) / 3600) * (1 - hrEff);

  const solarDateUtc = toSolarUtcDate(dateMidday, timezoneHours);
  const { altitude, azimuth } = solarPosition(solarDateUtc, latitude, longitude);
  const clearSky = skyGroundComponents(altitude);
  const DNI = safeRadiation(weatherRadiation?.DNI ?? clearSky.DNI);
  const DHI = safeRadiation(weatherRadiation?.DHI ?? clearSky.DHI);
  const GHI = safeRadiation(weatherRadiation?.GHI ?? clearSky.GHI);

  const wallAreas = {
    north: width * height,
    south: width * height,
    east: depth * height,
    west: depth * height,
  };

  let A_window_total = 0;
  const rooflightAreaM2 = Math.max(
    0,
    Number.isFinite(rooflight?.areaM2) ? rooflight.areaM2 : 0,
  );
  const rooflightUValue = Number.isFinite(rooflight?.uValue) ? rooflight.uValue : U_window;
  const rooflightGValue = Number.isFinite(rooflight?.gValue) ? rooflight.gValue : g_glass;
  let Q_solar = 0;
  const Q_solar_byFace = { north: 0, south: 0, east: 0, west: 0 };
  const I_beam_byFace = { north: 0, south: 0, east: 0, west: 0 };

  (windows || []).forEach((w) => {
    const { I_beam, I_diff, I_gnd } = planeIrradianceVertical({
      surfaceAzimuthDeg: w.az,
      altitudeDeg: altitude,
      azimuthDeg: azimuth,
      DNI,
      DHI,
      GHI,
      groundAlbedo,
    });

    const fracOverhang = overhangShadingFraction(w.h, w.overhangDepth || 0, altitude, azimuth, w.az);
    const fracVFins = finsShadingFraction(w.h, w.finDepth || 0, azimuth, w.az, w.overhangDepth || 0, altitude);
    const fracHFins = horizontalFinsShadingFraction(w.h, w.hFinDepth || 0, altitude, azimuth, w.az, w.overhangDepth || 0);
    const fracExt = Math.max(0, Math.min(1, 1 - (1 - fracOverhang) * (1 - fracVFins) * (1 - fracHFins)));

    const I_beam_shaded = I_beam * (1 - fracExt);
    const I_incident = I_beam + I_diff + I_gnd;

    const blindsFactor = autoBlinds && I_incident > blindsThreshold ? 1 - blindsReduction : 1;
    const I_total_effective = (I_beam_shaded + I_diff + I_gnd) * blindsFactor;

    const A = w.w * w.h;
    A_window_total += A;
    const faceGain = I_total_effective * g_glass * A;
    Q_solar += faceGain;
    const orientation = cardinalFromAzimuth(w.az);
    if (orientation) {
      Q_solar_byFace[orientation] += faceGain;
      I_beam_byFace[orientation] = I_beam;
      if (wallAreas[orientation] !== undefined) {
        wallAreas[orientation] = Math.max(0, wallAreas[orientation] - A);
      }
    }
  });

  let Q_solar_rooflight = 0;
  if (rooflightAreaM2 > 1e-6) {
    const { I_beam, I_diff, I_gnd } = planeIrradianceHorizontalUp({
      altitudeDeg: altitude,
      DNI,
      DHI,
    });
    const I_total_rooflight = I_beam + I_diff + I_gnd;
    Q_solar_rooflight = I_total_rooflight * rooflightGValue * rooflightAreaM2;
    Q_solar += Q_solar_rooflight;
  }

  const A_opaque = Object.values(wallAreas).reduce((acc, area) => acc + Math.max(0, area), 0);
  const A_floor = width * depth;
  const A_roof = Math.max(0, A_floor - rooflightAreaM2);

  const UA_walls = U_wall * A_opaque;
  const UA_windows = U_window * A_window_total;
  const UA_rooflight = rooflightUValue * rooflightAreaM2;
  const UA_roof = U_roof * A_roof;
  const UA_floor = U_floor * A_floor;
  const UA_out = UA_walls + UA_windows + UA_rooflight + UA_roof + UA_floor;
  const T_room_steady = T_out + (Q_solar + Q_internal) / ((UA_out + UA_vent) || 1e-6);
  const T_room = Number.isFinite(T_room_override) ? T_room_override : T_room_steady;

  const dT = T_room - T_out;
  const Q_loss_walls = UA_walls * dT;
  const Q_loss_windows = UA_windows * dT;
  const Q_loss_rooflight = UA_rooflight * dT;
  const Q_loss_roof = UA_roof * dT;
  const Q_loss_floor = UA_floor * dT;
  const Q_loss_fabric = UA_out * dT;
  const Q_loss_vent = UA_vent * dT;
  const Q_loss_total = Q_loss_fabric + Q_loss_vent;

  // Calculate desk-level illuminance
  const illuminanceLux = calculateDeskIlluminance(GHI, A_window_total, A_floor, g_glass, depth);

  return {
    T_room,
    T_room_steady,
    Q_solar,
    Q_solar_byFace,
    I_beam_byFace,
    UA_out,
    UA_vent,
    altitude,
    azimuth,
    DNI,
    DHI,
    GHI,
    A_window_total,
    A_rooflight: rooflightAreaM2,
    A_opaque,
    A_floor,
    A_roof,
    UA_components: {
      walls: UA_walls,
      windows: UA_windows,
      rooflight: UA_rooflight,
      roof: UA_roof,
      floor: UA_floor,
    },
    Q_loss_walls,
    Q_loss_windows,
    Q_loss_rooflight,
    Q_loss_roof,
    Q_loss_floor,
    Q_solar_rooflight,
    Q_loss_fabric,
    Q_loss_vent,
    Q_loss_total,
    illuminanceLux,
  };
}

export function daySunTimes(baseDateLocal, lat, lon, tzHours = 0) {
  const stepMin = 2;
  let prevAlt = null;
  let sunrise = null;
  let sunset = null;
  let firstAbove = false;
  for (let m = 0; m <= 24 * 60; m += stepMin) {
    const t = new Date(baseDateLocal.getTime() + m * 60 * 1000);
    const { altitude } = solarPosition(toSolarUtcDate(t, tzHours), lat, lon);
    if (prevAlt !== null) {
      if (prevAlt <= 0 && altitude > 0 && !sunrise) sunrise = t;
      if (prevAlt > 0 && altitude <= 0 && !sunset) sunset = t;
    }
    if (altitude > 0) firstAbove = true;
    prevAlt = altitude;
  }
  if (!firstAbove) {
    return {
      mode: "night",
      start: baseDateLocal,
      end: new Date(baseDateLocal.getTime() + 24 * 3600 * 1000),
    };
  }
  if (!sunrise || !sunset) {
    return {
      mode: "day",
      start: baseDateLocal,
      end: new Date(baseDateLocal.getTime() + 24 * 3600 * 1000),
    };
  }
  return { mode: "normal", start: sunrise, end: sunset };
}

export function classifyComfortState(tempC, comfortBand = COMFORT_BAND) {
  if (tempC < comfortBand.min) return "heating";
  if (tempC > comfortBand.max) return "cooling";
  return "comfortable";
}

export function simulateDay1R1C(params, baseDateLocal, weatherProvider, options = {}) {
  const stepMinutes = options.stepMinutes ?? SIMULATION_STEP_MINUTES;
  const spinupDays = options.spinupDays ?? SIMULATION_SPINUP_DAYS;
  const thermalCapacitance = options.thermalCapacitance ?? THERMAL_CAPACITANCE_J_PER_K;
  const comfortBand = options.comfortBand ?? COMFORT_BAND;
  const achTotalPreset = options.achTotal ?? ACH_INFILTRATION_DEFAULT;
  const heatRecoveryEfficiencyPreset = options.heatRecoveryEfficiency ?? 0;
  const manualOpenAchFixed = Math.max(0, options.manualOpenAch ?? 0);
  const manualVentilationInput = options.manualVentilationInput ?? null;
  const nightPurgeEnabled = options.nightPurgeEnabled ?? false;
  const adaptiveVentEnabled = options.adaptiveVentEnabled ?? false;
  const mvhrControlEnabled = options.mvhrControlEnabled ?? false;
  const mvhrControlActive =
    mvhrControlEnabled &&
    !adaptiveVentEnabled &&
    heatRecoveryEfficiencyPreset > 0;
  const startIndoorTemp = options.startIndoorTemp;
  const dtSeconds = stepMinutes * 60;
  const stepsPerDay = Math.round((24 * 60) / stepMinutes);
  const dayStart = new Date(
    Date.UTC(baseDateLocal.getUTCFullYear(), baseDateLocal.getUTCMonth(), baseDateLocal.getUTCDate()),
  );
  const spinupStart = new Date(dayStart.getTime() - spinupDays * 24 * 3600 * 1000);

  const evaluateStep = (time, indoorTemp, ventActivePrev, shouldLogTransitions = false) => {
    const forcing = forcingAt(time, weatherProvider);
    const hourOfDay = time.getUTCHours();
    const baseVent = adaptiveVentEnabled
      ? adaptiveVentilationStateForStep({
          indoorTemp,
          outdoorTemp: forcing.T_out,
          hourOfDay,
          comfortBand,
        })
      : mvhrControlActive
        ? mvhrVentilationStateForStep({
            indoorTemp,
            outdoorTemp: forcing.T_out,
            hourOfDay,
            baseAch: achTotalPreset,
            comfortBand,
          })
      : ventilationStateForStep({
          achTotal: achTotalPreset,
          hourOfDay,
          nightPurgeEnabled,
        });
    const manualVent = manualVentilationInput
      ? calculateManualWindowVentilation(
          manualVentilationInput.openedWindowArea,
          manualVentilationInput.volume,
          {
            roofOpeningAreaM2: manualVentilationInput.roofOpeningAreaM2,
            roomHeightM: manualVentilationInput.roomHeightM ?? params.height,
            stackHeightM: manualVentilationInput.stackHeightM,
            windMS: Number.isFinite(manualVentilationInput.fixedWindMS)
              ? manualVentilationInput.fixedWindMS
              : forcing.windMS,
            indoorTempC: indoorTemp,
            outdoorTempC: forcing.T_out,
          },
        )
      : null;
    const manualOpenAch = manualVent?.manualOpenAch ?? manualOpenAchFixed;
    const achTotal = baseVent.achTotal + manualOpenAch;
    const achWindow = Math.max(0, achTotal - ACH_INFILTRATION_DEFAULT);
    const vent = {
      ...baseVent,
      achTotal,
      achWindow,
      ventActive: achWindow > 0,
      manualOpenAch,
      manualVentilation: manualVent,
    };

    if (shouldLogTransitions && vent.ventActive !== ventActivePrev) {
      console.info(
        `[Vent] ${vent.ventActive ? "ON" : "OFF"} @ ${formatClockTime(time)} | Tin=${indoorTemp.toFixed(1)}C Tout=${forcing.T_out.toFixed(1)}C ACH=${vent.achTotal.toFixed(2)}`,
      );
    }

    // Heat recovery only applies to mechanical ventilation, not window-based ventilation
    // Disable HR when: adaptive mode, manual windows open, or night purge active
    const isNightPurgeActive =
      !mvhrControlActive &&
      nightPurgeEnabled &&
      (hourOfDay >= NIGHT_START_HOUR || hourOfDay < NIGHT_END_HOUR);
    const hasWindowVentilation = adaptiveVentEnabled || manualOpenAch > 0 || isNightPurgeActive;
    const effectiveHeatRecovery =
      hasWindowVentilation || baseVent.mvhrBypassActive
        ? 0
        : heatRecoveryEfficiencyPreset;

    const snapshot = computeSnapshot({
      ...params,
      dateMidday: time,
      T_out: forcing.T_out,
      achTotal: vent.achTotal,
      heatRecoveryEfficiency: effectiveHeatRecovery,
      weatherRadiation:
        Number.isFinite(forcing.DNI) || Number.isFinite(forcing.DHI) || Number.isFinite(forcing.GHI)
          ? { DNI: forcing.DNI, DHI: forcing.DHI, GHI: forcing.GHI }
          : undefined,
      T_room_override: indoorTemp,
    });
    const UA_total = snapshot.UA_out + snapshot.UA_vent;
    const Q_passive = snapshot.Q_solar + params.Q_internal;
    const dTdt = (Q_passive - UA_total * (indoorTemp - forcing.T_out)) / thermalCapacitance;
    return { snapshot, forcing, UA_total, Q_passive, dTdt, vent, effectiveHeatRecovery };
  };

  let indoorTemp = Number.isFinite(startIndoorTemp)
    ? startIndoorTemp
    : forcingAt(spinupStart, weatherProvider).T_out;
  let ventActive = false;
  let t = new Date(spinupStart);

  for (let i = 0; i < spinupDays * stepsPerDay; i++) {
    const step = evaluateStep(t, indoorTemp, ventActive);
    ventActive = step.vent.ventActive;
    indoorTemp += step.dTdt * dtSeconds;
    t = new Date(t.getTime() + dtSeconds * 1000);
  }

  const series = [];
  t = new Date(dayStart);
  for (let i = 0; i <= stepsPerDay; i++) {
    const step = evaluateStep(t, indoorTemp, ventActive, true);
    ventActive = step.vent.ventActive;
    const status = classifyComfortState(indoorTemp, comfortBand);
    // Steady-state HVAC: power to maintain setpoint temperature against heat flows
    const setpointTemp = status === "heating" ? comfortBand.min : comfortBand.max;
    const qHvacSteady = step.UA_total * (setpointTemp - step.forcing.T_out) - step.Q_passive;

    series.push({
      tf: i / stepsPerDay,
      time: t,
      timeLabel: formatClockTime(t),
      T_in: indoorTemp,
      T_out: step.forcing.T_out,
      DNI: step.forcing.DNI,
      DHI: step.forcing.DHI,
      GHI: step.forcing.GHI,
      solarAltitudeDeg: step.snapshot.altitude,
      solarAzimuthDeg: step.snapshot.azimuth,
      Q_solar: step.snapshot.Q_solar,
      Q_loss_fabric: step.snapshot.Q_loss_fabric,
      Q_loss_vent: step.snapshot.Q_loss_vent,
      status,
      heatingW: status === "heating" ? Math.max(0, qHvacSteady) : 0,
      coolingW: status === "cooling" ? Math.max(0, -qHvacSteady) : 0,
      ventilationHelpful: status === "cooling" && step.forcing.T_out < indoorTemp - 1,
      windMS: step.forcing.windMS,
      ventActive: step.vent.ventActive,
      achWindow: step.vent.achWindow,
      achTotal: step.vent.achTotal,
      manualOpenAch: step.vent.manualOpenAch,
      manualVentilationMode: step.vent.manualVentilation?.mode,
      adaptiveReason: step.vent.adaptiveReason,
      mvhrMode: step.vent.mvhrMode,
      mvhrBypassActive: step.vent.mvhrBypassActive === true,
      effectiveHeatRecovery: step.effectiveHeatRecovery,
      illuminanceLux: step.snapshot.illuminanceLux,
    });

    indoorTemp += step.dTdt * dtSeconds;
    t = new Date(t.getTime() + dtSeconds * 1000);
  }

  return { series, stepMinutes };
}

export function simulateAnnual1R1C(params, weatherProvider, options = {}) {
  const comfortBand = options.comfortBand ?? COMFORT_BAND;
  const thermalCapacitance = options.thermalCapacitance ?? THERMAL_CAPACITANCE_J_PER_K;
  const achTotalPreset = options.achTotal ?? ACH_INFILTRATION_DEFAULT;
  const heatRecoveryEfficiencyPreset = options.heatRecoveryEfficiency ?? 0;
  const manualOpenAchFixed = Math.max(0, options.manualOpenAch ?? 0);
  const manualVentilationInput = options.manualVentilationInput ?? null;
  const nightPurgeEnabled = options.nightPurgeEnabled ?? false;
  const adaptiveVentEnabled = options.adaptiveVentEnabled ?? false;
  const mvhrControlEnabled = options.mvhrControlEnabled ?? false;
  const mvhrControlActive =
    mvhrControlEnabled &&
    !adaptiveVentEnabled &&
    heatRecoveryEfficiencyPreset > 0;
  const spinupHours = options.spinupHours ?? 7 * 24;
  const pvModel = options.pvModel ?? null;
  const pvTiltDeg = Number.isFinite(pvModel?.tiltDeg) ? Math.max(0, pvModel.tiltDeg) : 0;
  const pvSurfaceAzimuthDeg = Number.isFinite(pvModel?.surfaceAzimuthDeg)
    ? pvModel.surfaceAzimuthDeg
    : 180;
  const pvGroundAlbedo = Number.isFinite(pvModel?.groundAlbedo)
    ? Math.max(0, pvModel.groundAlbedo)
    : 0.2;
  const startIndoorTemp = options.startIndoorTemp;
  const dtSeconds = 3600;
  const totalHours = 8760;
  const weekHours = 24 * 7;
  const weekCount = Math.ceil(totalHours / weekHours);

  const evaluateStep = (time, indoorTemp) => {
    const forcing = forcingAt(time, weatherProvider);
    const baseVent = adaptiveVentEnabled
      ? adaptiveVentilationStateForStep({
          indoorTemp,
          outdoorTemp: forcing.T_out,
          hourOfDay: time.getUTCHours(),
          comfortBand,
        })
      : mvhrControlActive
        ? mvhrVentilationStateForStep({
            indoorTemp,
            outdoorTemp: forcing.T_out,
            hourOfDay: time.getUTCHours(),
            baseAch: achTotalPreset,
            comfortBand,
          })
      : ventilationStateForStep({
          achTotal: achTotalPreset,
          hourOfDay: time.getUTCHours(),
          nightPurgeEnabled,
        });
    const manualVent = manualVentilationInput
      ? calculateManualWindowVentilation(
          manualVentilationInput.openedWindowArea,
          manualVentilationInput.volume,
          {
            roofOpeningAreaM2: manualVentilationInput.roofOpeningAreaM2,
            roomHeightM: manualVentilationInput.roomHeightM ?? params.height,
            stackHeightM: manualVentilationInput.stackHeightM,
            windMS: Number.isFinite(manualVentilationInput.fixedWindMS)
              ? manualVentilationInput.fixedWindMS
              : forcing.windMS,
            indoorTempC: indoorTemp,
            outdoorTempC: forcing.T_out,
          },
        )
      : null;
    const manualOpenAch = manualVent?.manualOpenAch ?? manualOpenAchFixed;
    const achTotal = baseVent.achTotal + manualOpenAch;
    const achWindow = Math.max(0, achTotal - ACH_INFILTRATION_DEFAULT);
    const vent = {
      ...baseVent,
      achTotal,
      achWindow,
      ventActive: achWindow > 0,
      manualOpenAch,
      manualVentilation: manualVent,
    };

    // Heat recovery only applies to mechanical ventilation, not window-based ventilation
    const hourOfDay = time.getUTCHours();
    const isNightPurgeActive =
      !mvhrControlActive &&
      nightPurgeEnabled &&
      (hourOfDay >= NIGHT_START_HOUR || hourOfDay < NIGHT_END_HOUR);
    const hasWindowVentilation = adaptiveVentEnabled || manualOpenAch > 0 || isNightPurgeActive;
    const effectiveHeatRecovery =
      hasWindowVentilation || baseVent.mvhrBypassActive
        ? 0
        : heatRecoveryEfficiencyPreset;

    const snapshot = computeSnapshot({
      ...params,
      dateMidday: time,
      T_out: forcing.T_out,
      achTotal: vent.achTotal,
      heatRecoveryEfficiency: effectiveHeatRecovery,
      weatherRadiation:
        Number.isFinite(forcing.DNI) || Number.isFinite(forcing.DHI) || Number.isFinite(forcing.GHI)
          ? { DNI: forcing.DNI, DHI: forcing.DHI, GHI: forcing.GHI }
          : undefined,
      T_room_override: indoorTemp,
    });
    const UA_total = snapshot.UA_out + snapshot.UA_vent;
    const Q_passive = snapshot.Q_solar + params.Q_internal;
    const dTdt = (Q_passive - UA_total * (indoorTemp - forcing.T_out)) / thermalCapacitance;
    return { snapshot, forcing, vent, dTdt, UA_total, Q_passive };
  };

  const spinupStart = dateFromTypicalYearHour(-spinupHours);
  let indoorTemp = Number.isFinite(startIndoorTemp)
    ? startIndoorTemp
    : forcingAt(spinupStart, weatherProvider).T_out;
  for (let h = -spinupHours; h < 0; h++) {
    const step = evaluateStep(dateFromTypicalYearHour(h), indoorTemp);
    indoorTemp += step.dTdt * dtSeconds;
  }

  const records = [];
  const monthly = Array.from({ length: 12 }, () => ({ over26: 0, over28: 0 }));
  const weeklyOverheat = Array.from({ length: weekCount }, () => 0);
  const weeklyOutdoorSum = Array.from({ length: weekCount }, () => 0);
  const weeklyOutdoorCount = Array.from({ length: weekCount }, () => 0);

  const metrics = {
    hoursInComfort: 0,
    overheatingHours26: 0,
    overheatingHours28: 0,
    tooColdHours: 0,
    heatingDegreeHours: 0,
    coolingDegreeHours: 0,
    heatingEnergyKWh: 0,
    coolingEnergyKWh: 0,
    globalHorizontalIrradianceKWhM2: 0,
    tiltedPlaneIrradianceKWhM2: 0,
    peakIndoorTemp: -Infinity,
    peakTime: dateFromTypicalYearHour(0),
    minIndoorTemp: Infinity,
    minTime: dateFromTypicalYearHour(0),
  };

  for (let hour = 0; hour < totalHours; hour++) {
    const date = dateFromTypicalYearHour(hour);
    const step = evaluateStep(date, indoorTemp);

    const status = classifyComfortState(indoorTemp, comfortBand);
    // Steady-state HVAC: power to maintain setpoint temperature against heat flows
    // Q_hvac = UA * (T_setpoint - T_out) - Q_passive
    // Positive = heating needed, Negative = cooling needed
    const setpointTemp = status === "heating" ? comfortBand.min : comfortBand.max;
    const qHvacSteady = step.UA_total * (setpointTemp - step.forcing.T_out) - step.Q_passive;
    const heatingW = status === "heating" ? Math.max(0, qHvacSteady) : 0;
    const coolingW = status === "cooling" ? Math.max(0, -qHvacSteady) : 0;
    const ghiWm2 = Number.isFinite(step.forcing.GHI) ? Math.max(0, step.forcing.GHI) : 0;
    const { I_beam: pvBeam, I_diff: pvDiff, I_gnd: pvGnd } = planeIrradianceTilted({
      tiltDeg: pvTiltDeg,
      surfaceAzimuthDeg: pvSurfaceAzimuthDeg,
      altitudeDeg: step.snapshot.altitude,
      azimuthDeg: step.snapshot.azimuth,
      DNI: step.forcing.DNI,
      DHI: step.forcing.DHI,
      GHI: step.forcing.GHI,
      groundAlbedo: pvGroundAlbedo,
    });
    const pvPlaneWm2 = pvBeam + pvDiff + pvGnd;
    metrics.heatingEnergyKWh += heatingW / 1000;
    metrics.coolingEnergyKWh += coolingW / 1000;
    metrics.globalHorizontalIrradianceKWhM2 += ghiWm2 / 1000;
    metrics.tiltedPlaneIrradianceKWhM2 += pvPlaneWm2 / 1000;
    const over26 = indoorTemp > 26;
    const over28 = indoorTemp > 28;
    const month = date.getUTCMonth();
    const week = Math.floor(hour / weekHours);

    if (status === "comfortable") metrics.hoursInComfort += 1;
    if (over26) metrics.overheatingHours26 += 1;
    if (over28) metrics.overheatingHours28 += 1;
    if (indoorTemp < comfortBand.min) metrics.tooColdHours += 1;
    metrics.heatingDegreeHours += Math.max(0, comfortBand.min - indoorTemp);
    metrics.coolingDegreeHours += Math.max(0, indoorTemp - comfortBand.max);
    if (indoorTemp > metrics.peakIndoorTemp) {
      metrics.peakIndoorTemp = indoorTemp;
      metrics.peakTime = date;
    }
    if (indoorTemp < metrics.minIndoorTemp) {
      metrics.minIndoorTemp = indoorTemp;
      metrics.minTime = date;
    }

    if (over26) monthly[month].over26 += 1;
    if (over28) monthly[month].over28 += 1;
    if (over26) weeklyOverheat[week] += 1;
    weeklyOutdoorSum[week] += step.forcing.T_out;
    weeklyOutdoorCount[week] += 1;

    records.push({
      hour,
      time: date,
      timeLabel: formatClockTime(date),
      dateLabel: formatMonthDayTime(date),
      T_in: indoorTemp,
      T_out: step.forcing.T_out,
      GHI: step.forcing.GHI,
      Q_solar: step.snapshot.Q_solar,
      ventOn: step.vent.ventActive ? 1 : 0,
      achTotal: step.vent.achTotal,
    });

    indoorTemp += step.dTdt * dtSeconds;
  }

  const histogram = buildTemperatureHistogram(records.map((r) => r.T_in));
  const monthlyData = MONTH_SHORT.map((label, idx) => ({
    month: label,
    over26: monthly[idx].over26,
    over28: monthly[idx].over28,
  }));

  let worstWeek = 0;
  let winterWeek = 0;
  for (let i = 1; i < weekCount; i++) {
    if (weeklyOverheat[i] > weeklyOverheat[worstWeek]) worstWeek = i;
    const meanOutdoor = weeklyOutdoorSum[i] / Math.max(1, weeklyOutdoorCount[i]);
    const currentWinterMean =
      weeklyOutdoorSum[winterWeek] / Math.max(1, weeklyOutdoorCount[winterWeek]);
    if (meanOutdoor < currentWinterMean) winterWeek = i;
  }

  const weekSeries = (weekIndex) => {
    const start = weekIndex * weekHours;
    const end = Math.min(start + weekHours, totalHours);
    return records.slice(start, end).map((row, idx) => ({
      hour: idx,
      clock: row.timeLabel,
      T_in: row.T_in,
      T_out: row.T_out,
    }));
  };

  const weekRangeLabel = (weekIndex) => {
    const startHour = weekIndex * weekHours;
    const endHour = Math.min(startHour + weekHours - 1, totalHours - 1);
    const startDate = dateFromTypicalYearHour(startHour);
    const endDate = dateFromTypicalYearHour(endHour);
    const startLabel = formatMonthDay(startDate);
    const endLabel = formatMonthDay(endDate);
    return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
  };

  return {
    metrics,
    histogram,
    monthlyData,
    worstWeek: {
      index: worstWeek,
      rangeLabel: weekRangeLabel(worstWeek),
      overheatingHours: weeklyOverheat[worstWeek],
      series: weekSeries(worstWeek),
    },
    winterWeek: {
      index: winterWeek,
      rangeLabel: weekRangeLabel(winterWeek),
      meanOutdoorC: weeklyOutdoorSum[winterWeek] / Math.max(1, weeklyOutdoorCount[winterWeek]),
      series: weekSeries(winterWeek),
    },
  };
}
