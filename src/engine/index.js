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
};
export const U_VALUE_PRESET_ORDER = ["baseline", "improved", "high"];
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
export const VENTILATION_PRESET_ORDER = ["background", "trickle", "open", "adaptive"];
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
export const PRICE_CAP_PERIOD_LABEL = "1 Jan-31 Mar 2026";
export const ENERGY_TARIFFS = {
  electricity: {
    unitRate: 0.2769,
    standingChargePerDay: 0.5475,
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
const CROSS_VENT_VELOCITY = 1.0; // m/s - effective velocity for cross-ventilation

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

export function computeCostCarbonSummary({ heatingThermalKWh, coolingThermalKWh, days = 1 }) {
  const safeHeating = Number.isFinite(heatingThermalKWh) ? heatingThermalKWh : 0;
  const safeCooling = Number.isFinite(coolingThermalKWh) ? coolingThermalKWh : 0;
  const heatingFuelKWh = safeHeating / Math.max(0.01, HEATING_SYSTEM.efficiency);
  const coolingFuelKWh = safeCooling / Math.max(0.01, COOLING_SYSTEM.cop);
  const energyCost =
    heatingFuelKWh * ENERGY_TARIFFS.gas.unitRate +
    coolingFuelKWh * ENERGY_TARIFFS.electricity.unitRate;
  const standingCost = INCLUDE_STANDING_CHARGES
    ? days *
      (ENERGY_TARIFFS.gas.standingChargePerDay +
        ENERGY_TARIFFS.electricity.standingChargePerDay)
    : 0;
  const totalCost = energyCost + standingCost;
  const carbonKg =
    heatingFuelKWh * CARBON_FACTORS.gas.perKWh +
    coolingFuelKWh * CARBON_FACTORS.electricity.consumption;
  return {
    heatingThermalKWh: safeHeating,
    coolingThermalKWh: safeCooling,
    heatingFuelKWh,
    coolingFuelKWh,
    energyCost,
    standingCost,
    totalCost,
    carbonKg,
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

export function forcingAt(dateLocal, provider) {
  if (provider?.mode === "epw" && provider.dataset) {
    const epw = epwForcingAt(dateLocal, provider.dataset);
    if (epw) return { ...epw, source: "epw" };
  }

  const T_out = outdoorTemperatureAt(dateLocal, provider.syntheticProfile || SYNTHETIC_PROFILE);
  return { T_out, source: "synthetic" };
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

export function ratioToDepthMeters(ratio) {
  return Math.max(0, Math.min(1, ratio || 0)) * BUILDING_HEIGHT;
}

export function buildWindowsFromFaceState(faceState, orientationDeg = 0) {
  return FACES.map((face) => {
    const config = faceState[face.id];
    if (!config || config.glazing <= 0) return null;
    const glazing = Math.max(0, Math.min(0.8, config.glazing));
    const faceSpan = face.id === "east" || face.id === "west" ? BUILDING_DEPTH : BUILDING_WIDTH;
    return {
      w: faceSpan * glazing,
      h: BUILDING_HEIGHT,
      az: normalizedAzimuth(face.azimuth + orientationDeg),
      overhangDepth: ratioToDepthMeters(config.overhang),
      finDepth: ratioToDepthMeters(config.fin),
      hFinDepth: ratioToDepthMeters(config.hFin),
    };
  }).filter(Boolean);
}

export function buildPreviewFaceConfigs(faceState) {
  return FACES.reduce((acc, face) => {
    const config = faceState[face.id] || { glazing: 0, overhang: 0, fin: 0, hFin: 0 };
    acc[face.id] = {
      glazing: Math.max(0, Math.min(0.8, config.glazing)),
      overhang: ratioToDepthMeters(config.overhang),
      fin: ratioToDepthMeters(config.fin),
      hFin: ratioToDepthMeters(config.hFin),
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

export function finsShadingFraction(windowW, finDepth_m, azimuthDeg, surfaceAzimuthDeg) {
  if (finDepth_m <= 0) return 0;

  // Check if sun is hitting this surface (within ±90° of surface normal)
  const dAzDeg = ((azimuthDeg - surfaceAzimuthDeg + 540) % 360) - 180;
  if (Math.abs(dAzDeg) >= 90) return 0; // Sun is behind this surface

  // Brise-soleil geometry: fins at regular intervals with fixed 0.5m projection
  const FIN_PROJECTION = 0.5; // Fixed 50cm projection
  const MIN_GAP = 0.15; // Minimum gap between fins (dense)
  const MAX_GAP = 1.2; // Maximum gap between fins (sparse)

  // finDepth_m is actually a ratio encoded as meters (0 to ~2.6m)
  // Convert back to 0-1 ratio to calculate gap
  const ratio = Math.min(1, finDepth_m / BUILDING_HEIGHT);
  const gap = MAX_GAP - ratio * (MAX_GAP - MIN_GAP);

  // Calculate shadow width from each fin based on sun angle
  const dAz = deg2rad(dAzDeg);
  const shadowWidth = Math.abs(FIN_PROJECTION * Math.tan(dAz));

  // Shading fraction is the ratio of shadow width to gap between fins
  return Math.max(0, Math.min(1, shadowWidth / gap));
}

export function horizontalFinsShadingFraction(windowH, hFinDepth_m, altDeg, azimuthDeg, surfaceAzimuthDeg) {
  if (hFinDepth_m <= 0 || altDeg <= 0) return 0;

  // Check if sun is hitting this surface (within ±90° of surface normal)
  const dAzDeg = ((azimuthDeg - surfaceAzimuthDeg + 540) % 360) - 180;
  if (Math.abs(dAzDeg) >= 90) return 0; // Sun is behind this surface

  // Horizontal louver geometry: slats at regular intervals with fixed projection
  const SLAT_PROJECTION = 0.5; // Fixed 50cm projection (matches vertical fins)
  const MIN_GAP = 0.1; // Minimum gap between slats (dense)
  const MAX_GAP = 0.6; // Maximum gap between slats (sparse)

  // hFinDepth_m is a ratio encoded as meters (0 to ~2.6m)
  // Convert back to 0-1 ratio to calculate gap
  const ratio = Math.min(1, hFinDepth_m / BUILDING_HEIGHT);
  const gap = MAX_GAP - ratio * (MAX_GAP - MIN_GAP);

  // Calculate shadow depth from each slat based on profile angle (sun altitude relative to surface)
  const phi = profileAngle(altDeg, azimuthDeg, surfaceAzimuthDeg);
  if (phi <= 0) return 0;
  const shadowDepth = SLAT_PROJECTION * Math.tan(deg2rad(phi));

  // Shading fraction is the ratio of shadow depth to gap between slats
  return Math.max(0, Math.min(1, shadowDepth / gap));
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
    T_out,
    Q_internal,
    latitude,
    longitude,
    dateMidday,
    groundAlbedo,
    T_room_override,
    weatherRadiation,
    timezoneHours = 0,
  } = params;

  const volume = width * depth * height;
  const UA_vent = (RHO_AIR * CP_AIR * achTotal * volume) / 3600;

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
    const fracVFins = finsShadingFraction(w.w, w.finDepth || 0, azimuth, w.az);
    const fracHFins = horizontalFinsShadingFraction(w.h, w.hFinDepth || 0, altitude, azimuth, w.az);
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

  const A_opaque = Object.values(wallAreas).reduce((acc, area) => acc + Math.max(0, area), 0);
  const A_floor = width * depth;
  const A_roof = A_floor;

  const UA_walls = U_wall * A_opaque;
  const UA_windows = U_window * A_window_total;
  const UA_roof = U_roof * A_roof;
  const UA_floor = U_floor * A_floor;
  const UA_out = UA_walls + UA_windows + UA_roof + UA_floor;
  const T_room_steady = T_out + (Q_solar + Q_internal) / ((UA_out + UA_vent) || 1e-6);
  const T_room = Number.isFinite(T_room_override) ? T_room_override : T_room_steady;

  const dT = T_room - T_out;
  const Q_loss_walls = UA_walls * dT;
  const Q_loss_windows = UA_windows * dT;
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
    A_opaque,
    A_floor,
    A_roof,
    UA_components: {
      walls: UA_walls,
      windows: UA_windows,
      roof: UA_roof,
      floor: UA_floor,
    },
    Q_loss_walls,
    Q_loss_windows,
    Q_loss_roof,
    Q_loss_floor,
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
  const nightPurgeEnabled = options.nightPurgeEnabled ?? false;
  const adaptiveVentEnabled = options.adaptiveVentEnabled ?? false;
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
    const vent = adaptiveVentEnabled
      ? adaptiveVentilationStateForStep({
          indoorTemp,
          outdoorTemp: forcing.T_out,
          hourOfDay,
          comfortBand,
        })
      : ventilationStateForStep({
          achTotal: achTotalPreset,
          hourOfDay,
          nightPurgeEnabled,
        });

    if (shouldLogTransitions && vent.ventActive !== ventActivePrev) {
      console.info(
        `[Vent] ${vent.ventActive ? "ON" : "OFF"} @ ${formatClockTime(time)} | Tin=${indoorTemp.toFixed(1)}C Tout=${forcing.T_out.toFixed(1)}C ACH=${vent.achTotal.toFixed(2)}`,
      );
    }

    const snapshot = computeSnapshot({
      ...params,
      dateMidday: time,
      T_out: forcing.T_out,
      achTotal: vent.achTotal,
      weatherRadiation:
        forcing.source === "epw"
          ? { DNI: forcing.DNI, DHI: forcing.DHI, GHI: forcing.GHI }
          : undefined,
      T_room_override: indoorTemp,
    });
    const UA_total = snapshot.UA_out + snapshot.UA_vent;
    const Q_passive = snapshot.Q_solar + params.Q_internal;
    const dTdt = (Q_passive - UA_total * (indoorTemp - forcing.T_out)) / thermalCapacitance;
    return { snapshot, forcing, UA_total, Q_passive, dTdt, vent };
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
      adaptiveReason: step.vent.adaptiveReason,
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
  const nightPurgeEnabled = options.nightPurgeEnabled ?? false;
  const adaptiveVentEnabled = options.adaptiveVentEnabled ?? false;
  const spinupHours = options.spinupHours ?? 7 * 24;
  const startIndoorTemp = options.startIndoorTemp;
  const dtSeconds = 3600;
  const totalHours = 8760;
  const weekHours = 24 * 7;
  const weekCount = Math.ceil(totalHours / weekHours);

  const evaluateStep = (time, indoorTemp, ventActivePrev) => {
    const forcing = forcingAt(time, weatherProvider);
    const vent = adaptiveVentEnabled
      ? adaptiveVentilationStateForStep({
          indoorTemp,
          outdoorTemp: forcing.T_out,
          hourOfDay: time.getUTCHours(),
          comfortBand,
        })
      : ventilationStateForStep({
          achTotal: achTotalPreset,
          hourOfDay: time.getUTCHours(),
          nightPurgeEnabled,
        });
    const snapshot = computeSnapshot({
      ...params,
      dateMidday: time,
      T_out: forcing.T_out,
      achTotal: vent.achTotal,
      weatherRadiation:
        forcing.source === "epw"
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
  let ventActive = false;
  for (let h = -spinupHours; h < 0; h++) {
    const step = evaluateStep(dateFromTypicalYearHour(h), indoorTemp, ventActive);
    ventActive = step.vent.ventActive;
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
    heatingDegreeHours: 0,
    coolingDegreeHours: 0,
    heatingEnergyKWh: 0,
    coolingEnergyKWh: 0,
    peakIndoorTemp: -Infinity,
    peakTime: dateFromTypicalYearHour(0),
  };

  for (let hour = 0; hour < totalHours; hour++) {
    const date = dateFromTypicalYearHour(hour);
    const step = evaluateStep(date, indoorTemp, ventActive);
    ventActive = step.vent.ventActive;

    const status = classifyComfortState(indoorTemp, comfortBand);
    // Steady-state HVAC: power to maintain setpoint temperature against heat flows
    // Q_hvac = UA * (T_setpoint - T_out) - Q_passive
    // Positive = heating needed, Negative = cooling needed
    const setpointTemp = status === "heating" ? comfortBand.min : comfortBand.max;
    const qHvacSteady = step.UA_total * (setpointTemp - step.forcing.T_out) - step.Q_passive;
    const heatingW = status === "heating" ? Math.max(0, qHvacSteady) : 0;
    const coolingW = status === "cooling" ? Math.max(0, -qHvacSteady) : 0;
    metrics.heatingEnergyKWh += heatingW / 1000;
    metrics.coolingEnergyKWh += coolingW / 1000;
    const over26 = indoorTemp > 26;
    const over28 = indoorTemp > 28;
    const month = date.getUTCMonth();
    const week = Math.floor(hour / weekHours);

    if (status === "comfortable") metrics.hoursInComfort += 1;
    if (over26) metrics.overheatingHours26 += 1;
    if (over28) metrics.overheatingHours28 += 1;
    metrics.heatingDegreeHours += Math.max(0, comfortBand.min - indoorTemp);
    metrics.coolingDegreeHours += Math.max(0, indoorTemp - comfortBand.max);
    if (indoorTemp > metrics.peakIndoorTemp) {
      metrics.peakIndoorTemp = indoorTemp;
      metrics.peakTime = date;
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
