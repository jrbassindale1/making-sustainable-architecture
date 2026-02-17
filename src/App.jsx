import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  ReferenceArea,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { InfoPopover } from "@/components/ui/info-popover";
import { Vector3 } from "three";
import { BuildingPreview } from "@/scene/BuildingPreview";
import { drawOverlays, calculateLayout } from "@/export/OverlayRenderer";
import {
  ACH_INFILTRATION_DEFAULT,
  BUILDING_DEPTH,
  BUILDING_HEIGHT,
  BUILDING_WIDTH,
  COMFORT_BAND,
  DAYS_PER_YEAR,
  DEFAULT_SITE,
  DEFAULT_U_VALUE_PRESET,
  DEFAULT_VENTILATION_PRESET,
  FACES,
  MAX_VENTILATION_ACH,
  NIGHT_END_HOUR,
  NIGHT_START_HOUR,
  SIMULATION_SPINUP_DAYS,
  SIMULATION_STEP_MINUTES,
  SUMMER_SOLSTICE_DAY,
  SYNTHETIC_PROFILE,
  THERMAL_CAPACITANCE_J_PER_K,
  U_VALUE_PRESETS,
  U_VALUE_PRESET_ORDER,
  VENTILATION_PRESETS,
  VENTILATION_PRESET_ORDER,
  LUX_THRESHOLDS,
  MIN_WINDOW_CLEAR_HEIGHT,
  ROOFLIGHT_MAX_EDGE_OFFSET_M,
  ROOFLIGHT_MIN_CLEAR_SPAN_M,
  WINDOW_SEGMENT_STATE,
  WINDOW_OPEN_TRAVEL_M,
  assessVentilationComfort,
  buildPreviewFaceConfigs,
  calculateManualWindowVentilation,
  calculateOpeningArea,
  calculateOpenedWindowArea,
  clampWindowCenterRatio,
  buildWindowsFromFaceState,
  cardinalFromAzimuth,
  computeCostCarbonSummary,
  computeSnapshot,
  dateFromDayOfYearUTC,
  daySunTimes,
  deg2rad,
  forcingAt,
  formatClockTime,
  formatHourRange,
  formatMonthDayTime,
  isNightHour,
  normalizedAzimuth,
  nextWindowSegmentState,
  normalizeWindowSegmentState,
  resolveRooflightConfig,
  resolveWindowOpeningHeight,
  simulateAnnual1R1C,
  simulateDay1R1C,
  WINTER_SOLSTICE_DAY,
  SPRING_EQUINOX_DAY,
  AUTUMN_EQUINOX_DAY,
} from "@/engine";
import {
  ComfortGuidanceCard,
  CostCarbonCard,
  EnergyAssumptionsCard,
  EnvelopeAssumptionsCard,
  GainsLossesCard,
  IlluminanceCard,
  InsightsCard,
  Metric,
  OutcomeCard,
  SliderField,
  VentilationCard,
} from "@/components/cards";

const MIDDAY_TIME_FRAC = 0.5;
const GLASS_G_VALUE = 0.4;
const DOWNLIGHTS_OFF_HOUR = 23;
const DOWNLIGHTS_PRE_SUNRISE_HOURS = 1; // Turn on this many hours before sunrise
const DOWNLIGHT_INTENSITY_DEFAULT = 60;
const DOWNLIGHT_BEAM_ANGLE_DEFAULT = 0.95;
const DOWNLIGHT_PENUMBRA_DEFAULT = 1;
const DOWNLIGHT_THROW_SCALE_DEFAULT = 2.5;
const DOWNLIGHT_SOURCE_GLOW_DEFAULT = 2.5;
const STANDARD_SW_WIND_MPH = 5;
const STANDARD_SW_WIND_MS = STANDARD_SW_WIND_MPH * 0.44704;
const STANDARD_SW_WIND_DIR_DEG = 225;

export default function App() {
  const initialSolsticeDay =
    DEFAULT_SITE.latitude >= 0 ? SUMMER_SOLSTICE_DAY : WINTER_SOLSTICE_DAY;
  const [faceState, setFaceState] = useState({
    north: { glazing: 0.5, overhang: 0, fin: 0, hFin: 0, cillLift: 0, headDrop: 0, windowCenterRatio: 0 },
    east: { glazing: 0.5, overhang: 0, fin: 0, hFin: 0, cillLift: 0, headDrop: 0, windowCenterRatio: 0 },
    south: { glazing: 0.5, overhang: 0, fin: 0, hFin: 0, cillLift: 0, headDrop: 0, windowCenterRatio: 0 },
    west: { glazing: 0.5, overhang: 0, fin: 0, hFin: 0, cillLift: 0, headDrop: 0, windowCenterRatio: 0 },
  });

  const updateFace = (faceId, field, value) => {
    setFaceState((prev) => {
      const current = prev[faceId];
      if (!current) return prev;
      const next = { ...current, [field]: value };
      if (field === "glazing") {
        const glazing = Math.max(0, Math.min(0.8, value));
        next.glazing = glazing;
        next.windowCenterRatio = clampWindowCenterRatio(glazing, current.windowCenterRatio ?? 0);
      } else if (field === "windowCenterRatio") {
        next.windowCenterRatio = clampWindowCenterRatio(current.glazing ?? 0, value);
      }
      return { ...prev, [faceId]: next };
    });
  };

  const [orientationDeg, setOrientationDeg] = useState(0);
  const [buildingWidth, setBuildingWidth] = useState(BUILDING_WIDTH);
  const [buildingDepth, setBuildingDepth] = useState(BUILDING_DEPTH);
  const [buildingHeight, setBuildingHeight] = useState(BUILDING_HEIGHT);
  const [openWindowSegments, setOpenWindowSegments] = useState({});
  const [rooflightState, setRooflightState] = useState({
    width: ROOFLIGHT_MIN_CLEAR_SPAN_M,
    depth: ROOFLIGHT_MIN_CLEAR_SPAN_M,
    openHeight: 0,
  });
  const [rooflightEnabled, setRooflightEnabled] = useState(true);
  const [downlightIntensity, setDownlightIntensity] = useState(DOWNLIGHT_INTENSITY_DEFAULT);
  const [downlightBeamAngle, setDownlightBeamAngle] = useState(DOWNLIGHT_BEAM_ANGLE_DEFAULT);
  const [downlightPenumbra, setDownlightPenumbra] = useState(DOWNLIGHT_PENUMBRA_DEFAULT);
  const [downlightThrowScale, setDownlightThrowScale] = useState(DOWNLIGHT_THROW_SCALE_DEFAULT);
  const [downlightSourceGlow, setDownlightSourceGlow] = useState(DOWNLIGHT_SOURCE_GLOW_DEFAULT);
  const [viewMode, setViewMode] = useState("explore");
  const [exploreTab, setExploreTab] = useState("context");
  const [ventilationPreset, setVentilationPreset] = useState(DEFAULT_VENTILATION_PRESET);
  const [nightPurgeEnabled, setNightPurgeEnabled] = useState(false);
  const [uValuePreset, setUValuePreset] = useState(DEFAULT_U_VALUE_PRESET);
  const [dayOfYear, setDayOfYear] = useState(initialSolsticeDay);
  const [timeFrac, setTimeFrac] = useState(MIDDAY_TIME_FRAC);
  const [exportingVideo, setExportingVideo] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportingPngs, setExportingPngs] = useState(false);
  const [exportError, setExportError] = useState("");
  const mainCaptureRef = useRef(null);
  const moreDetailsRef = useRef(null);
  const dailyChartContainerRef = useRef(null);
  const [dailyChartSize, setDailyChartSize] = useState({ width: 0, height: 0 });

  const faceFacingLabel = (face) => {
    const azimuth = normalizedAzimuth(face.azimuth + orientationDeg);
    const cardinal = cardinalFromAzimuth(azimuth);
    if (!cardinal) return `${Math.round(azimuth)}°`;
    const cardinalLabel = `${cardinal[0].toUpperCase()}${cardinal.slice(1)}`;
    return `${cardinalLabel} (${Math.round(azimuth)}°)`;
  };

  const effectiveWeatherMode = "synthetic";
  const weatherMeta = DEFAULT_SITE;

  const weatherSummary = useMemo(() => {
    return "Simplified (Pencilli - Brecon)";
  }, []);

  const seasonalMarks = useMemo(() => {
    const isNorthern = weatherMeta.latitude >= 0;
    const summerDay = isNorthern ? SUMMER_SOLSTICE_DAY : WINTER_SOLSTICE_DAY;
    const winterDay = isNorthern ? WINTER_SOLSTICE_DAY : SUMMER_SOLSTICE_DAY;
    const marchLabel = isNorthern ? "Spring equinox" : "Autumn equinox";
    const septLabel = isNorthern ? "Autumn equinox" : "Spring equinox";
    return [
      { day: summerDay, label: "Summer solstice" },
      { day: winterDay, label: "Winter solstice" },
      { day: SPRING_EQUINOX_DAY, label: marchLabel },
      { day: AUTUMN_EQUINOX_DAY, label: septLabel },
    ].sort((a, b) => a.day - b.day);
  }, [weatherMeta.latitude]);

  const weatherDescription = useMemo(() => {
    return "Simplified seasonal temperature curve plus clear-sky sunlight for Pencilli - Brecon.";
  }, []);

  useEffect(() => {
    const node = dailyChartContainerRef.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setDailyChartSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      });
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const maxTotal = Math.max(0, buildingHeight - MIN_WINDOW_CLEAR_HEIGHT);
    setFaceState((prev) => {
      let changed = false;
      const next = { ...prev };

      FACES.forEach((face) => {
        const current = prev[face.id];
        if (!current) return;
        let cillLift = Math.max(0, Math.min(current.cillLift ?? 0, maxTotal));
        let headDrop = Math.max(0, Math.min(current.headDrop ?? 0, maxTotal));

        if (cillLift + headDrop > maxTotal) {
          const overflow = cillLift + headDrop - maxTotal;
          if (headDrop >= overflow) {
            headDrop -= overflow;
          } else {
            cillLift = Math.max(0, cillLift - (overflow - headDrop));
            headDrop = 0;
          }
        }

        if (cillLift !== (current.cillLift ?? 0) || headDrop !== (current.headDrop ?? 0)) {
          changed = true;
          next[face.id] = { ...current, cillLift, headDrop };
        }
      });

      return changed ? next : prev;
    });
  }, [buildingHeight]);

  const activeUPreset = useMemo(
    () => U_VALUE_PRESETS[uValuePreset] ?? U_VALUE_PRESETS[DEFAULT_U_VALUE_PRESET],
    [uValuePreset],
  );
  const activeUValues = activeUPreset.values;
  const activeVentPreset = useMemo(
    () =>
      VENTILATION_PRESETS[ventilationPreset] ??
      VENTILATION_PRESETS[DEFAULT_VENTILATION_PRESET],
    [ventilationPreset],
  );
  const ventilationAchTotal = activeVentPreset.achTotal;
  const adaptiveVentEnabled = activeVentPreset.isAdaptive === true;

  const selectedDate = useMemo(() => dateFromDayOfYearUTC(dayOfYear), [dayOfYear]);
  const selectedDateLabel = useMemo(
    () =>
      selectedDate.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
    [selectedDate],
  );
  const selectedDayDateLabel = useMemo(
    () =>
      selectedDate.toLocaleDateString([], {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      }),
    [selectedDate],
  );
  const effectiveSpinupDays = SIMULATION_SPINUP_DAYS;

  const windows = useMemo(
    () =>
      buildWindowsFromFaceState(faceState, orientationDeg, {
        width: buildingWidth,
        depth: buildingDepth,
        height: buildingHeight,
      }),
    [faceState, orientationDeg, buildingWidth, buildingDepth, buildingHeight],
  );
  const previewFaceConfigs = useMemo(
    () =>
      buildPreviewFaceConfigs(faceState, {
        height: buildingHeight,
      }),
    [faceState, buildingHeight],
  );
  const totalGlazingArea = useMemo(
    () => windows.reduce((sum, window) => sum + window.w * window.h, 0),
    [windows],
  );
  const totalWallArea = 2 * (buildingWidth + buildingDepth) * buildingHeight;
  const overallWWR = totalGlazingArea / totalWallArea;
  const faceWWR = useMemo(
    () =>
      FACES.reduce((acc, face) => {
        const faceSpan = face.id === "east" || face.id === "west" ? buildingDepth : buildingWidth;
        const config = faceState[face.id] ?? {};
        const opening = resolveWindowOpeningHeight(
          buildingHeight,
          config.cillLift,
          config.headDrop,
          MIN_WINDOW_CLEAR_HEIGHT,
        );
        const glazing = Math.max(0, Math.min(0.8, config.glazing ?? 0));
        const glazedArea = faceSpan * glazing * opening.effectiveHeight;
        const wallArea = faceSpan * buildingHeight;
        acc[face.id] = wallArea > 0 ? glazedArea / wallArea : 0;
        return acc;
      }, {}),
    [faceState, buildingWidth, buildingDepth, buildingHeight],
  );
  const buildingFloorArea = buildingWidth * buildingDepth;
  const buildingVolume = buildingFloorArea * buildingHeight;
  const rooflightSpec = useMemo(
    () => resolveRooflightConfig(rooflightState, { width: buildingWidth, depth: buildingDepth }),
    [rooflightState, buildingWidth, buildingDepth],
  );
  const effectiveRooflightOpenHeight = rooflightEnabled ? rooflightSpec.openHeight : 0;
  const effectiveRooflightOpeningAreaM2 = rooflightEnabled ? rooflightSpec.openingAreaM2 : 0;
  const rooflightThermalProps = useMemo(
    () => ({
      areaM2: rooflightEnabled ? Math.max(0, rooflightSpec.width * rooflightSpec.depth) : 0,
      uValue: activeUValues.window,
      gValue: GLASS_G_VALUE,
    }),
    [rooflightEnabled, rooflightSpec.width, rooflightSpec.depth, activeUValues.window],
  );
  const hasRooflightOpen = rooflightEnabled && rooflightSpec.isOpen;
  const rooflightSizeLimits = useMemo(
    () => ({ minSize: ROOFLIGHT_MIN_CLEAR_SPAN_M, maxWidth: rooflightSpec.maxWidth, maxDepth: rooflightSpec.maxDepth }),
    [rooflightSpec.maxWidth, rooflightSpec.maxDepth],
  );
  const openedWindowArea = useMemo(
    () =>
      calculateOpenedWindowArea(
        faceState,
        {
          width: buildingWidth,
          depth: buildingDepth,
          height: buildingHeight,
        },
        openWindowSegments,
      ),
    [faceState, buildingWidth, buildingDepth, buildingHeight, openWindowSegments],
  );
  const manualVentilationInput = useMemo(
    () => ({
      openedWindowArea,
      volume: buildingVolume,
      roofOpeningAreaM2: effectiveRooflightOpeningAreaM2,
      roomHeightM: buildingHeight,
      fixedWindMS: STANDARD_SW_WIND_MS,
      fixedWindDirDeg: STANDARD_SW_WIND_DIR_DEG,
    }),
    [openedWindowArea, buildingVolume, effectiveRooflightOpeningAreaM2, buildingHeight],
  );
  const hasManualOpenWindows = openedWindowArea.openLeafCount > 0;
  const hasManualOpenings = hasManualOpenWindows || hasRooflightOpen;

  const setOverallGlazing = (value) => {
    const clamped = Math.max(0, Math.min(0.8, value));
    setFaceState((prev) => {
      const next = { ...prev };
      FACES.forEach((face) => {
        next[face.id] = {
          ...prev[face.id],
          glazing: clamped,
          windowCenterRatio: clampWindowCenterRatio(
            clamped,
            prev[face.id]?.windowCenterRatio ?? 0,
          ),
        };
      });
      return next;
    });
  };
  const handlePreviewFaceGlazingResize = useCallback((faceId, payload) => {
    setFaceState((prev) => {
      const current = prev[faceId];
      if (!current) return prev;
      const currentGlazing = Math.max(0, Math.min(0.8, current.glazing ?? 0));
      const currentCenter = clampWindowCenterRatio(
        currentGlazing,
        current.windowCenterRatio ?? 0,
      );
      const nextGlazingRaw =
        typeof payload === "number" ? payload : payload?.glazing ?? currentGlazing;
      const nextGlazing = Math.max(0, Math.min(0.8, nextGlazingRaw));
      const nextCenterRaw =
        payload && typeof payload === "object" && Number.isFinite(payload.centerRatio)
          ? payload.centerRatio
          : currentCenter;
      const nextCenter = clampWindowCenterRatio(nextGlazing, nextCenterRaw);
      if (
        Math.abs(currentGlazing - nextGlazing) < 1e-4 &&
        Math.abs(currentCenter - nextCenter) < 1e-4
      ) {
        return prev;
      }
      return {
        ...prev,
        [faceId]: { ...current, glazing: nextGlazing, windowCenterRatio: nextCenter },
      };
    });
  }, []);

  const handleFaceCillLiftChange = (faceId, nextValue) => {
    const maxTotal = Math.max(0, buildingHeight - MIN_WINDOW_CLEAR_HEIGHT);
    setFaceState((prev) => {
      const current = prev[faceId];
      if (!current) return prev;
      const cillLift = Math.max(0, Math.min(nextValue, maxTotal));
      const maxHeadDrop = Math.max(0, maxTotal - cillLift);
      const headDrop = Math.max(0, Math.min(current.headDrop ?? 0, maxHeadDrop));
      return { ...prev, [faceId]: { ...current, cillLift, headDrop } };
    });
  };

  const handleFaceHeadDropChange = (faceId, nextValue) => {
    const maxTotal = Math.max(0, buildingHeight - MIN_WINDOW_CLEAR_HEIGHT);
    setFaceState((prev) => {
      const current = prev[faceId];
      if (!current) return prev;
      const headDrop = Math.max(0, Math.min(nextValue, maxTotal));
      const maxCillLift = Math.max(0, maxTotal - headDrop);
      const cillLift = Math.max(0, Math.min(current.cillLift ?? 0, maxCillLift));
      return { ...prev, [faceId]: { ...current, cillLift, headDrop } };
    });
  };

  useEffect(() => {
    setRooflightState((prev) => {
      const resolved = resolveRooflightConfig(prev, {
        width: buildingWidth,
        depth: buildingDepth,
      });
      const next = {
        width: resolved.width,
        depth: resolved.depth,
        openHeight: resolved.openHeight,
      };
      if (
        Math.abs(next.width - prev.width) < 1e-6 &&
        Math.abs(next.depth - prev.depth) < 1e-6 &&
        Math.abs(next.openHeight - prev.openHeight) < 1e-6
      ) {
        return prev;
      }
      return next;
    });
  }, [buildingWidth, buildingDepth]);

  const handleRooflightSizeChange = (axis, nextValue) => {
    setRooflightState((prev) => {
      const resolved = resolveRooflightConfig(
        { ...prev, [axis]: nextValue },
        { width: buildingWidth, depth: buildingDepth },
      );
      return {
        width: resolved.width,
        depth: resolved.depth,
        openHeight: resolved.openHeight,
      };
    });
  };

  const toggleRooflightOpen = () => {
    if (!rooflightEnabled) return;
    setRooflightState((prev) => ({
      ...prev,
      openHeight: prev.openHeight > 0.001 ? 0 : WINDOW_OPEN_TRAVEL_M,
    }));
  };
  const handleRooflightEnabledChange = (enabled) => {
    setRooflightEnabled(enabled);
    if (!enabled) {
      setRooflightState((prev) => ({ ...prev, openHeight: 0 }));
    }
  };

  const toggleWindowSegment = (faceId, segmentIndex) => {
    const key = `${faceId}:${segmentIndex}`;
    setOpenWindowSegments((prev) => {
      const currentState = normalizeWindowSegmentState(prev[key]);
      const nextState = nextWindowSegmentState(currentState);
      if (nextState === WINDOW_SEGMENT_STATE.CLOSED) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: nextState };
    });
  };

  const baseParamsTemplate = useMemo(
    () => ({
      width: buildingWidth,
      depth: buildingDepth,
      height: buildingHeight,
      U_wall: activeUValues.wall,
      U_window: activeUValues.window,
      U_roof: activeUValues.roof,
      U_floor: activeUValues.floor,
      autoBlinds: false,
      blindsThreshold: 400,
      blindsReduction: 0.5,
      g_glass: GLASS_G_VALUE, // Low-E glazing (was 0.6 for standard glazing)
      rooflight: rooflightThermalProps,
      Q_internal: 180,
      latitude: weatherMeta.latitude,
      longitude: weatherMeta.longitude,
      timezoneHours: weatherMeta.tzHours,
      groundAlbedo: 0.25,
    }),
    [
      activeUValues,
      weatherMeta.latitude,
      weatherMeta.longitude,
      weatherMeta.tzHours,
      buildingWidth,
      buildingDepth,
      buildingHeight,
      rooflightThermalProps,
    ],
  );
  const baseParams = useMemo(
    () => ({ ...baseParamsTemplate, windows }),
    [baseParamsTemplate, windows],
  );

  const weatherProvider = useMemo(
    () => ({
      mode: effectiveWeatherMode,
      dataset: null,
      syntheticProfile: SYNTHETIC_PROFILE,
    }),
    [effectiveWeatherMode],
  );

  const sunWindow = useMemo(
    () => daySunTimes(selectedDate, weatherMeta.latitude, weatherMeta.longitude, weatherMeta.tzHours),
    [selectedDate, weatherMeta.latitude, weatherMeta.longitude, weatherMeta.tzHours],
  );
  const sunWindowLabel = useMemo(() => {
    if (sunWindow.mode === "night") return "Sun below horizon all day";
    if (sunWindow.mode === "day") return "Sun above horizon all day";
    return `${formatClockTime(sunWindow.start)} -> ${formatClockTime(sunWindow.end)}`;
  }, [sunWindow]);

  const daySimulation = useMemo(
    () =>
      simulateDay1R1C(baseParams, selectedDate, weatherProvider, {
        comfortBand: COMFORT_BAND,
        stepMinutes: SIMULATION_STEP_MINUTES,
        spinupDays: effectiveSpinupDays,
        thermalCapacitance: THERMAL_CAPACITANCE_J_PER_K,
        achTotal: ventilationAchTotal,
        manualVentilationInput,
        nightPurgeEnabled,
        adaptiveVentEnabled,
      }),
    [
      baseParams,
      selectedDate,
      weatherProvider,
      ventilationAchTotal,
      manualVentilationInput,
      nightPurgeEnabled,
      adaptiveVentEnabled,
      effectiveSpinupDays,
    ],
  );

  const daySeries = daySimulation.series;
  const selectedPoint = useMemo(() => {
    if (daySeries.length === 0) return null;
    const safeTime = Number.isFinite(timeFrac) ? timeFrac : MIDDAY_TIME_FRAC;
    const idx = Math.max(0, Math.min(daySeries.length - 1, Math.round(safeTime * (daySeries.length - 1))));
    return daySeries[idx];
  }, [daySeries, timeFrac]);

  const dateAtTime = selectedPoint?.time ?? selectedDate;
  const timeLabel = selectedPoint?.timeLabel ?? formatClockTime(selectedDate);
  const selectedHour =
    selectedPoint?.time?.getUTCHours?.() ??
    Math.floor((Number.isFinite(timeFrac) ? timeFrac : MIDDAY_TIME_FRAC) * 24);
  const selectedHourRangeLabel = formatHourRange(selectedHour);
  const isNightTime = isNightHour(dateAtTime.getUTCHours());
  const currentForcing = useMemo(
    () => forcingAt(dateAtTime, weatherProvider),
    [dateAtTime, weatherProvider],
  );
  const outdoorTemp = currentForcing.T_out;
  const cloudCover = currentForcing.totalSkyCover; // tenths (0-10), undefined if synthetic
  const indoorTempAtTime = selectedPoint?.T_in ?? outdoorTemp;
  const manualWindowVentilation = useMemo(
    () =>
      calculateManualWindowVentilation(openedWindowArea, buildingVolume, {
        roofOpeningAreaM2: effectiveRooflightOpeningAreaM2,
        roomHeightM: buildingHeight,
        windMS: STANDARD_SW_WIND_MS,
        indoorTempC: indoorTempAtTime,
        outdoorTempC: outdoorTemp,
      }),
    [
      openedWindowArea,
      buildingVolume,
      effectiveRooflightOpeningAreaM2,
      buildingHeight,
      indoorTempAtTime,
      outdoorTemp,
    ],
  );
  const openedWindowAch = selectedPoint?.manualOpenAch ?? manualWindowVentilation.manualOpenAch;
  const manualWindowModeText = useMemo(() => {
    if (!hasManualOpenings) return "none";
    if (manualWindowVentilation.mode === "roof-only") return "rooflight-only";
    if (manualWindowVentilation.mode === "cross") {
      const pairLabel =
        manualWindowVentilation.activeCrossPair === "north-south"
          ? "north-south"
          : manualWindowVentilation.activeCrossPair === "east-west"
            ? "east-west"
            : null;
      return pairLabel ? `cross-ventilation (${pairLabel})` : "cross-ventilation";
    }
    if (manualWindowVentilation.mode === "multi-face") return "multi-face";
    return "single-sided";
  }, [hasManualOpenings, manualWindowVentilation]);
  const rooflightVentSummaryText = rooflightEnabled
    ? `${effectiveRooflightOpeningAreaM2.toFixed(2)} m² @ ${(effectiveRooflightOpenHeight * 1000).toFixed(0)} mm`
    : "OFF";
  const manualWindowSummaryText = hasManualOpenings
    ? ` Manual openings add ${manualWindowVentilation.totalManualOpenAreaM2.toFixed(2)} m² free area (~${openedWindowAch.toFixed(1)} ACH, ${manualWindowModeText}; wind ${(manualWindowVentilation.windMS ?? 0).toFixed(1)} m/s, dT ${(indoorTempAtTime - outdoorTemp).toFixed(1)}°C; windows ${openedWindowArea.totalOpenAreaM2.toFixed(2)} m² [${openedWindowArea.topHungLeafCount} top-hung = ${openedWindowArea.topHungAreaM2.toFixed(2)} m², ${openedWindowArea.turnLeafCount} turn = ${openedWindowArea.turnAreaM2.toFixed(2)} m²], rooflight ${rooflightVentSummaryText}).`
    : "";
  const achTotalAtTime = selectedPoint?.achTotal ?? ventilationAchTotal + openedWindowAch;
  const ventilationComfort = useMemo(
    () =>
      assessVentilationComfort({
        achTotal: achTotalAtTime,
        indoorTemp: indoorTempAtTime,
        outdoorTemp,
      }),
    [achTotalAtTime, indoorTempAtTime, outdoorTemp],
  );
  const comfortStatus = selectedPoint?.status ?? "comfortable";
  const perceivedComfortStatus =
    ventilationComfort.perceivedTempC < COMFORT_BAND.min
      ? "heating"
      : ventilationComfort.perceivedTempC > COMFORT_BAND.max
        ? "cooling"
        : "comfortable";
  const comfortStatusLabel =
    comfortStatus === "heating"
      ? "Below comfort"
      : comfortStatus === "cooling"
        ? "Above comfort"
        : "Within comfort";
  const perceivedComfortLabel =
    perceivedComfortStatus === "heating"
      ? "Below comfort"
      : perceivedComfortStatus === "cooling"
        ? "Above comfort"
        : "Within comfort";
  const adaptiveReason = selectedPoint?.adaptiveReason;
  const baseVentilationLabel = adaptiveVentEnabled
    ? adaptiveReason === "day-cooling"
      ? "Adaptive (cooling)"
      : adaptiveReason === "night-cooling"
        ? "Adaptive (night cool)"
        : adaptiveReason === "night-floor"
          ? "Adaptive (floor reached)"
          : adaptiveReason === "outdoor-warm"
            ? "Adaptive (outdoor warm)"
            : "Adaptive (comfortable)"
    : nightPurgeEnabled && isNightTime
      ? "Night purge"
      : activeVentPreset.label;
  const ventilationLabel = hasManualOpenings
    ? `${baseVentilationLabel} + manual openings`
    : baseVentilationLabel;
  const ventilationSummary = adaptiveVentEnabled
    ? `Adaptive ventilation: windows open automatically when cooling is beneficial (0.6-6.0 ACH).${manualWindowSummaryText}`
    : nightPurgeEnabled
      ? `${activeVentPreset.label} by day, night purge at ${VENTILATION_PRESETS.purge.achTotal.toFixed(1)} air changes per hour (22:00-06:00).${manualWindowSummaryText}`
      : `${activeVentPreset.label} (${ventilationAchTotal.toFixed(1)} air changes per hour).${manualWindowSummaryText}`;
  const ventilationComfortSummary = `Draught comfort check: ${ventilationComfort.label} (apparent cooling ~${ventilationComfort.apparentCoolingC.toFixed(1)}°C, feels like ~${ventilationComfort.perceivedTempC.toFixed(1)}°C).`;
  const ventilationSummaryWithComfort = `${ventilationSummary} ${ventilationComfortSummary}`;
  const ventilationWindAssumptionText = `Manual-opening airflow uses a fixed southwest wind of ${STANDARD_SW_WIND_MPH} mph.`;

  const snapshot = useMemo(() => {
    const indoorTempOverride = selectedPoint?.T_in;
    return computeSnapshot({
      ...baseParams,
      dateMidday: dateAtTime,
      T_out: outdoorTemp,
      achTotal: achTotalAtTime,
      weatherRadiation:
        currentForcing.source === "epw"
          ? { DNI: currentForcing.DNI, DHI: currentForcing.DHI, GHI: currentForcing.GHI }
          : undefined,
      T_room_override: indoorTempOverride,
    });
  }, [baseParams, dateAtTime, outdoorTemp, achTotalAtTime, currentForcing, selectedPoint?.T_in]);
  const downlightsOn = useMemo(() => {
    const rawHour =
      Number.isFinite(selectedHour) ? selectedHour : dateAtTime.getUTCHours();
    const normalizedHour = ((Math.floor(rawHour) % 24) + 24) % 24;

    // Calculate "on" hour based on sunrise (1 hour before)
    let onHour = 6; // fallback if no sunrise
    if (sunWindow.mode === "normal" && sunWindow.start) {
      const sunriseHour = sunWindow.start.getHours() + sunWindow.start.getMinutes() / 60;
      onHour = Math.max(0, sunriseHour - DOWNLIGHTS_PRE_SUNRISE_HOURS);
    } else if (sunWindow.mode === "night") {
      // Polar night - lights can be on all "day"
      onHour = 0;
    }

    const isWithinSchedule =
      normalizedHour >= onHour && normalizedHour < DOWNLIGHTS_OFF_HOUR;
    return isWithinSchedule && (snapshot.illuminanceLux ?? 0) < LUX_THRESHOLDS.adequate;
  }, [selectedHour, dateAtTime, snapshot.illuminanceLux, sunWindow]);
  const solarGainNow = Number.isFinite(selectedPoint?.Q_solar)
    ? selectedPoint.Q_solar
    : snapshot.Q_solar;
  const solarGainHelper = snapshot.altitude <= 0 ? "Sun below horizon" : "Selected time";

  const daySummary = useMemo(() => {
    if (daySeries.length <= 1) return null;
    const stepHours = (daySimulation.stepMinutes || SIMULATION_STEP_MINUTES) / 60;
    return daySeries.slice(0, -1).reduce(
      (acc, point) => {
        if (point.status === "comfortable") acc.comfortableHours += stepHours;
        if (point.status === "heating") acc.heatingHours += stepHours;
        if (point.status === "cooling") acc.coolingHours += stepHours;
        acc.heatingEnergyKWh += (point.heatingW * stepHours) / 1000;
        acc.coolingEnergyKWh += (point.coolingW * stepHours) / 1000;
        return acc;
      },
      {
        comfortableHours: 0,
        heatingHours: 0,
        coolingHours: 0,
        heatingEnergyKWh: 0,
        coolingEnergyKWh: 0,
      },
    );
  }, [daySeries, daySimulation.stepMinutes]);

  const dayCostSummary = useMemo(() => {
    if (!daySummary) return null;
    return computeCostCarbonSummary({
      heatingThermalKWh: daySummary.heatingEnergyKWh,
      coolingThermalKWh: daySummary.coolingEnergyKWh,
      days: 1,
    });
  }, [daySummary]);

  const formatDateStamp = (date) => date.toISOString().slice(0, 10);
  const formatExportStamp = () =>
    new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const A4_EXPORT_SIZE = { width: 2480, height: 3508 };
  const downloadFile = (filename, content, type = "application/octet-stream") => {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const waitForNextFrame = () =>
    new Promise((resolve) => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 0);
      });
    });

  const renderCanvasToA4 = (sourceCanvas) => {
    const output = document.createElement("canvas");
    output.width = A4_EXPORT_SIZE.width;
    output.height = A4_EXPORT_SIZE.height;
    const ctx = output.getContext("2d");
    if (!ctx) return null;

    const margin = 130;
    const drawWidthMax = output.width - margin * 2;
    const drawHeightMax = output.height - margin * 2;
    const scale = Math.min(drawWidthMax / sourceCanvas.width, drawHeightMax / sourceCanvas.height);
    const drawWidth = sourceCanvas.width * scale;
    const drawHeight = sourceCanvas.height * scale;
    const drawX = (output.width - drawWidth) / 2;
    const drawY = margin;

    ctx.fillStyle = "#f5f3ee";
    ctx.fillRect(0, 0, output.width, output.height);
    ctx.drawImage(sourceCanvas, drawX, drawY, drawWidth, drawHeight);
    return output;
  };

  const downloadCanvasPng = (filename, canvas) =>
    new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Unable to create PNG blob."));
          return;
        }
        downloadFile(filename, blob, "image/png");
        resolve();
      }, "image/png");
    });

  const exportSnapshotPngs = async () => {
    if (exportingPngs) return;
    const frontTarget = mainCaptureRef.current;
    if (!frontTarget) return;
    const infoPopoverNodes = Array.from(frontTarget.querySelectorAll("details[data-info-popover]"));
    const previouslyOpenInfoPopovers = infoPopoverNodes.filter((node) => node.open);
    infoPopoverNodes.forEach((node) => {
      node.open = false;
    });

    const moreDetailsNode = moreDetailsRef.current;
    const wasMoreDetailsOpen = Boolean(moreDetailsNode?.open);
    if (moreDetailsNode) {
      moreDetailsNode.open = true;
    }

    const glazingSummary = [
      `Total window-to-wall ratio: ${Math.round(overallWWR * 100)}%`,
      `North (${faceFacingLabel(FACES.find((f) => f.id === "north"))}): ${Math.round((faceWWR.north ?? 0) * 100)}%`,
      `East (${faceFacingLabel(FACES.find((f) => f.id === "east"))}): ${Math.round((faceWWR.east ?? 0) * 100)}%`,
      `South (${faceFacingLabel(FACES.find((f) => f.id === "south"))}): ${Math.round((faceWWR.south ?? 0) * 100)}%`,
      `West (${faceFacingLabel(FACES.find((f) => f.id === "west"))}): ${Math.round((faceWWR.west ?? 0) * 100)}%`,
    ].join("\n");
    const shadingSummary = [
      `North: overhang ${faceState.north.overhang.toFixed(2)}, vertical fins ${faceState.north.fin.toFixed(2)}, horizontal fins ${faceState.north.hFin.toFixed(2)}`,
      `East: overhang ${faceState.east.overhang.toFixed(2)}, vertical fins ${faceState.east.fin.toFixed(2)}, horizontal fins ${faceState.east.hFin.toFixed(2)}`,
      `South: overhang ${faceState.south.overhang.toFixed(2)}, vertical fins ${faceState.south.fin.toFixed(2)}, horizontal fins ${faceState.south.hFin.toFixed(2)}`,
      `West: overhang ${faceState.west.overhang.toFixed(2)}, vertical fins ${faceState.west.fin.toFixed(2)}, horizontal fins ${faceState.west.hFin.toFixed(2)}`,
    ].join("\n");
    const fabricSummary = [
      `Preset: ${activeUPreset.label}`,
      `${activeUPreset.detail}`,
      `U-values (W/m2K):`,
      `Walls ${activeUValues.wall.toFixed(2)} | Roof ${activeUValues.roof.toFixed(2)}`,
      `Floor ${activeUValues.floor.toFixed(2)} | Windows ${activeUValues.window.toFixed(2)}`,
    ].join("\n");
    const ventilationSummaryCompact = [
      `Preset: ${activeVentPreset.label}`,
      `${activeVentPreset.detail}`,
      `Current rate: ${achTotalAtTime.toFixed(1)} air changes per hour`,
      hasManualOpenings
        ? `Manual openings: total ${manualWindowVentilation.totalManualOpenAreaM2.toFixed(2)} m², ~${openedWindowAch.toFixed(1)} ACH (${manualWindowModeText})`
        : `Manual openings: none open`,
      `Windows: ${openedWindowArea.openLeafCount}/${openedWindowArea.totalLeafCount} sashes (${openedWindowArea.topHungLeafCount} top-hung = ${openedWindowArea.topHungAreaM2.toFixed(2)} m², ${openedWindowArea.turnLeafCount} turn = ${openedWindowArea.turnAreaM2.toFixed(2)} m²)`,
      rooflightEnabled
        ? `Rooflight: ON · ${rooflightSpec.width.toFixed(2)} × ${rooflightSpec.depth.toFixed(2)} m, open ${Math.round(effectiveRooflightOpenHeight * 1000)} mm (${effectiveRooflightOpeningAreaM2.toFixed(2)} m² free area)`
        : `Rooflight: OFF`,
      `${ventilationComfort.label}: feels like ${ventilationComfort.perceivedTempC.toFixed(1)}°C (${ventilationComfort.apparentCoolingC.toFixed(1)}°C apparent cooling)`,
      `Adaptive mode: ${adaptiveVentEnabled ? "On" : "Off"}`,
      `Night purge: ${adaptiveVentEnabled ? "Controlled by adaptive mode" : nightPurgeEnabled ? "On" : "Off"}`,
    ].join("\n");

    const chartNode = dailyChartContainerRef.current;
    if (chartNode) {
      const rect = chartNode.getBoundingClientRect();
      flushSync(() => {
        setDailyChartSize({
          width: Math.max(0, Math.floor(rect.width)),
          height: Math.max(0, Math.floor(rect.height)),
        });
      });
    }

    setExportingPngs(true);
    setExportError("");
    let frontExportHost = null;
    try {
      const { default: html2canvas } = await import("html2canvas");
      // Let layout settle after opening "More details" and updating fixed chart size.
      await waitForNextFrame();
      await waitForNextFrame();
      const frontClone = frontTarget.cloneNode(true);
      frontExportHost = document.createElement("div");
      frontExportHost.style.position = "fixed";
      frontExportHost.style.left = "-10000px";
      frontExportHost.style.top = "0";
      frontExportHost.style.width = `${frontTarget.clientWidth}px`;
      frontExportHost.style.background = "#f5f3ee";
      frontExportHost.style.zIndex = "-1";
      frontClone.style.height = "auto";
      frontClone.style.maxHeight = "none";
      frontClone.style.minHeight = "0";
      frontClone.style.overflow = "visible";
      const frontHeader = document.createElement("div");
      frontHeader.style.marginBottom = "16px";
      frontHeader.style.padding = "10px 12px";
      frontHeader.style.border = "1px solid #cbd5e1";
      frontHeader.style.borderRadius = "8px";
      frontHeader.style.background = "#ffffff";
      frontHeader.style.fontFamily = "Space Grotesk, Segoe UI, sans-serif";
      frontHeader.style.fontSize = "16px";
      frontHeader.style.fontWeight = "700";
      frontHeader.style.color = "#334155";
      frontHeader.textContent = `Location: ${weatherSummary} | Date: ${selectedDayDateLabel} | Time: ${selectedHourRangeLabel}`;
      frontClone.prepend(frontHeader);
      frontExportHost.appendChild(frontClone);
      document.body.appendChild(frontExportHost);

      frontClone.querySelectorAll("details[data-info-popover]").forEach((node) => {
        node.removeAttribute("open");
        node.style.display = "none";
      });
      const cloneMoreDetails = frontClone.querySelector("details[data-export-more-details]");
      if (cloneMoreDetails) {
        cloneMoreDetails.open = true;
        cloneMoreDetails.setAttribute("open", "");
      }

      const frontSummaryGrid = document.createElement("div");
      frontSummaryGrid.style.marginTop = "10px";
      frontSummaryGrid.style.display = "grid";
      frontSummaryGrid.style.gridTemplateColumns = "1fr 1fr";
      frontSummaryGrid.style.gap = "8px";
      frontSummaryGrid.style.fontFamily = "Space Grotesk, Segoe UI, sans-serif";
      const frontSummaryTitle = document.createElement("p");
      frontSummaryTitle.textContent = "Environemntal Settings";
      frontSummaryTitle.style.margin = "10px 0 0 0";
      frontSummaryTitle.style.fontSize = "12px";
      frontSummaryTitle.style.fontWeight = "700";
      frontSummaryTitle.style.textTransform = "uppercase";
      frontSummaryTitle.style.letterSpacing = "0.04em";
      frontSummaryTitle.style.color = "#64748b";

      const createSummaryCell = (title, body) => {
        const cell = document.createElement("div");
        cell.style.border = "1px solid #cbd5e1";
        cell.style.borderRadius = "8px";
        cell.style.background = "#ffffff";
        cell.style.padding = "8px 10px";

        const h = document.createElement("p");
        h.style.margin = "0 0 4px 0";
        h.style.fontSize = "11px";
        h.style.fontWeight = "700";
        h.style.textTransform = "uppercase";
        h.style.letterSpacing = "0.04em";
        h.style.color = "#475569";
        h.textContent = title;

        const b = document.createElement("p");
        b.style.margin = "0";
        b.style.fontSize = "14px";
        b.style.lineHeight = "1.375";
        b.style.whiteSpace = "pre-line";
        b.style.color = "#475569";
        b.textContent = body;

        cell.appendChild(h);
        cell.appendChild(b);
        return cell;
      };

      frontSummaryGrid.appendChild(createSummaryCell("Glazing", glazingSummary));
      frontSummaryGrid.appendChild(createSummaryCell("Shading", shadingSummary));
      frontSummaryGrid.appendChild(createSummaryCell("Fabric", fabricSummary));
      frontSummaryGrid.appendChild(createSummaryCell("Ventilation", ventilationSummaryCompact));
      if (cloneMoreDetails) {
        cloneMoreDetails.insertAdjacentElement("afterend", frontSummaryTitle);
        frontSummaryTitle.insertAdjacentElement("afterend", frontSummaryGrid);
      } else {
        frontClone.appendChild(frontSummaryTitle);
        frontClone.appendChild(frontSummaryGrid);
      }

      const sourceChartNode = dailyChartContainerRef.current;
      const cloneChartNode = frontClone.querySelector("[data-export-temp-chart]");
      if (sourceChartNode && cloneChartNode) {
        const chartCanvas = await html2canvas(sourceChartNode, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
        });
        const chartImg = document.createElement("img");
        chartImg.src = chartCanvas.toDataURL("image/png");
        chartImg.style.width = "100%";
        chartImg.style.height = "100%";
        chartImg.style.display = "block";
        chartImg.style.objectFit = "contain";
        cloneChartNode.innerHTML = "";
        cloneChartNode.style.overflow = "hidden";
        cloneChartNode.appendChild(chartImg);
        await new Promise((resolve) => {
          chartImg.onload = resolve;
          chartImg.onerror = resolve;
        });
      }

      const sourceModelNode = frontTarget.querySelector("[data-export-model-panel]");
      const cloneModelNode = frontClone.querySelector("[data-export-model-panel]");
      if (sourceModelNode && cloneModelNode) {
        const modelCanvas = await html2canvas(sourceModelNode, {
          backgroundColor: "#f5f3ee",
          scale: 2,
          useCORS: true,
          logging: false,
        });
        const modelImg = document.createElement("img");
        modelImg.src = modelCanvas.toDataURL("image/png");
        modelImg.style.width = "100%";
        modelImg.style.height = "100%";
        modelImg.style.display = "block";
        modelImg.style.objectFit = "contain";
        cloneModelNode.innerHTML = "";
        cloneModelNode.style.overflow = "hidden";
        cloneModelNode.appendChild(modelImg);
        await new Promise((resolve) => {
          modelImg.onload = resolve;
          modelImg.onerror = resolve;
        });
      }

      await waitForNextFrame();
      const frontCaptureWidth = Math.max(frontClone.scrollWidth, frontClone.clientWidth);
      const frontCaptureHeight = Math.max(frontClone.scrollHeight, frontClone.clientHeight);
      const frontCanvas = await html2canvas(frontClone, {
        backgroundColor: "#f5f3ee",
        scale: 2,
        useCORS: true,
        logging: false,
        width: frontCaptureWidth,
        height: frontCaptureHeight,
        windowWidth: frontCaptureWidth,
        windowHeight: frontCaptureHeight,
        scrollX: 0,
        scrollY: 0,
      });
      const frontA4Canvas = renderCanvasToA4(frontCanvas);
      if (!frontA4Canvas) {
        throw new Error("Canvas context unavailable.");
      }

      const dateStamp = formatDateStamp(selectedDate);
      const exportStamp = formatExportStamp();
      await downloadCanvasPng(
        `room-comfort-frontpage-${dateStamp}-${exportStamp}.png`,
        frontA4Canvas,
      );
    } catch (error) {
      console.error("[Export] PNG snapshots failed:", error);
      setExportError("PNG export failed. Please try again.");
    } finally {
      if (frontExportHost?.parentNode) {
        frontExportHost.parentNode.removeChild(frontExportHost);
      }
      if (moreDetailsNode && !wasMoreDetailsOpen) {
        moreDetailsNode.open = false;
      }
      previouslyOpenInfoPopovers.forEach((node) => {
        node.open = true;
      });
      setExportingPngs(false);
    }
  };

  const exportDayVideo = async () => {
    if (exportingVideo) return;
    if (daySeries.length === 0) return;
    if (
      typeof window === "undefined" ||
      typeof MediaRecorder === "undefined" ||
      typeof HTMLCanvasElement === "undefined" ||
      !HTMLCanvasElement.prototype.captureStream
    ) {
      setExportError("Video export is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    setExportingVideo(true);
    setExportProgress(0);
    setExportError("");
    const previousTime = timeFrac;

    try {
      await waitForNextFrame();
      const fps = 30;
      const durationSeconds = 20;
      const outputWidth = 1920;
      const outputHeight = 1080;

      // Create capture canvas
      const captureCanvas = document.createElement("canvas");
      captureCanvas.width = outputWidth;
      captureCanvas.height = outputHeight;
      const ctx = captureCanvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable.");

      // Calculate layout for overlays
      const layout = calculateLayout(outputWidth, outputHeight);

      // Setup video recording
      const mimeCandidates = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      const mimeType = mimeCandidates.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? "";
      if (!mimeType) {
        throw new Error("Video recording not supported in this browser.");
      }

      const stream = captureCanvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];
      const recorderStopped = new Promise((resolve) => {
        recorder.onstop = resolve;
      });
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };
      recorder.start();

      // Calculate total frames
      const totalFrames = Math.ceil(fps * durationSeconds);
      const bgColor = "#f5f3ee";

      // Render frames
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        // Calculate progress and data index
        const progress = frameIndex / (totalFrames - 1);
        const dataIndex = Math.min(
          Math.floor(progress * daySeries.length),
          daySeries.length - 1
        );
        const frameData = daySeries[dataIndex];

        // Update React state to sync 3D scene
        setTimeFrac(progress);
        await waitForNextFrame();
        // Extra frame to ensure Three.js has rendered
        await waitForNextFrame();

        // Clear canvas and fill background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, outputWidth, outputHeight);

        // Get the Three.js canvas (R3F applies className to wrapper div, canvas is inside)
        const threeCanvas = document.querySelector(".building-preview-canvas canvas");
        if (threeCanvas) {
          try {
            // Calculate how to fit the 3D scene in the layout
            const sceneAspect = threeCanvas.width / threeCanvas.height;
            const targetAspect = layout.sceneWidth / layout.sceneHeight;

            let drawWidth, drawHeight, drawX, drawY;

            if (sceneAspect > targetAspect) {
              // Scene is wider - fit to width
              drawWidth = layout.sceneWidth;
              drawHeight = layout.sceneWidth / sceneAspect;
              drawX = 0;
              drawY = (layout.sceneHeight - drawHeight) / 2;
            } else {
              // Scene is taller - fit to height
              drawHeight = layout.sceneHeight;
              drawWidth = layout.sceneHeight * sceneAspect;
              drawX = (layout.sceneWidth - drawWidth) / 2;
              drawY = 0;
            }

            ctx.drawImage(threeCanvas, drawX, drawY, drawWidth, drawHeight);
          } catch (error) {
            console.warn("[Export] Unable to draw WebGL canvas:", error);
          }
        }

        // Draw overlays (metrics panel and mini chart)
        drawOverlays(ctx, frameData, daySeries, dataIndex, layout);

        // Report progress
        setExportProgress((frameIndex + 1) / totalFrames);

        // Small delay every few frames to keep browser responsive
        if (frameIndex % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      // Stop recording and create video
      recorder.stop();
      await recorderStopped;
      const videoBlob = new Blob(chunks, { type: mimeType });
      setExportProgress(1);
      downloadFile(
        `room-comfort-day-${formatDateStamp(selectedDate)}-${formatExportStamp()}.webm`,
        videoBlob,
        mimeType,
      );
    } catch (error) {
      console.error("[Export] Video failed:", error);
      setExportError("Video export failed. Try Chrome/Edge and keep the tab visible.");
    } finally {
      setTimeFrac(previousTime);
      setExportingVideo(false);
      setExportProgress(0);
    }
  };

  const annualCurrent = useMemo(
    () =>
      simulateAnnual1R1C(baseParams, weatherProvider, {
        comfortBand: COMFORT_BAND,
        thermalCapacitance: THERMAL_CAPACITANCE_J_PER_K,
        achTotal: ventilationAchTotal,
        manualVentilationInput,
        nightPurgeEnabled,
        adaptiveVentEnabled,
        spinupHours: effectiveSpinupDays * 24,
      }),
    [
      baseParams,
      weatherProvider,
      ventilationAchTotal,
      manualVentilationInput,
      nightPurgeEnabled,
      adaptiveVentEnabled,
      effectiveSpinupDays,
    ],
  );

  const annualCostSummary = useMemo(() => {
    if (!annualCurrent) return null;
    return computeCostCarbonSummary({
      heatingThermalKWh: annualCurrent.metrics.heatingEnergyKWh,
      coolingThermalKWh: annualCurrent.metrics.coolingEnergyKWh,
      days: DAYS_PER_YEAR,
    });
  }, [annualCurrent]);

  const sunDirection = useMemo(() => {
    const altRad = deg2rad(snapshot.altitude);
    const azRad = deg2rad(snapshot.azimuth);
    return new Vector3(
      Math.sin(azRad) * Math.cos(altRad),
      Math.sin(altRad),
      Math.cos(azRad) * Math.cos(altRad),
    ).normalize();
  }, [snapshot.altitude, snapshot.azimuth]);

  const chartData = useMemo(() => {
    if (daySeries.length === 0) return [];
    return daySeries.map((point) => ({
      hour: point.tf * 24,
      time: point.timeLabel,
      roomTemperature: point.T_in,
      outdoorTemperature: point.T_out,
      solarGain: point.Q_solar,
      ventAch: point.achTotal,
      ventOn: point.ventActive ? 1 : 0,
      heatLoss: point.Q_loss_fabric + point.Q_loss_vent,
    }));
  }, [daySeries]);

  const chartDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 1];
    const values = chartData.flatMap((point) => [point.roomTemperature, point.outdoorTemperature]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (Math.abs(max - min) < 0.2) return [min - 1, max + 1];
    return [Math.floor((min - 1) * 2) / 2, Math.ceil((max + 1) * 2) / 2];
  }, [chartData]);
  const ventChartDomainMax = useMemo(() => {
    if (chartData.length === 0) return MAX_VENTILATION_ACH + 0.5;
    const peakVent = chartData.reduce(
      (acc, point) => Math.max(acc, Number.isFinite(point.ventAch) ? point.ventAch : 0),
      MAX_VENTILATION_ACH,
    );
    return Math.max(MAX_VENTILATION_ACH + 0.5, Math.ceil((peakVent + 0.5) * 2) / 2);
  }, [chartData]);

  const dayHourTicks = useMemo(
    () => Array.from({ length: 13 }, (_, idx) => idx * 2),
    [],
  );

  const dayEnergyBreakdown = useMemo(() => {
    if (daySeries.length <= 1) return null;
    const stepHours = daySimulation.stepMinutes / 60;
    return daySeries.slice(0, -1).reduce(
      (acc, point) => {
        acc.solarGainKWh += (point.Q_solar * stepHours) / 1000;
        acc.fabricLossKWh += (Math.max(0, point.Q_loss_fabric) * stepHours) / 1000;
        acc.ventLossKWh += (Math.max(0, point.Q_loss_vent) * stepHours) / 1000;
        return acc;
      },
      { solarGainKWh: 0, fabricLossKWh: 0, ventLossKWh: 0 },
    );
  }, [daySeries, daySimulation.stepMinutes]);

  const viewTabs = [
    { id: "explore", label: "explore" },
    { id: "explain", label: "explain" },
    { id: "evaluate", label: "evaluate (year)" },
  ];

  const exploreTabs = [
    { id: "context", label: "Context" },
    { id: "general", label: "General settings" },
    { id: "glazing", label: "Glazing" },
    { id: "shading", label: "Shading" },
    { id: "fabric", label: "Fabric (U values)" },
    { id: "ventilation", label: "Ventilation" },
    { id: "export", label: "Export" },
  ];

  return (
    <div className="relative min-h-screen bg-[#f5f3ee] lg:h-[100svh] lg:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.65),transparent_55%)]" />
      <main className="relative z-10 mx-auto flex w-full max-w-none flex-col gap-4 px-4 pb-6 pt-6 lg:h-full lg:min-h-0 lg:px-8 lg:pb-5 lg:pt-5">
        <header className="flex flex-col gap-3 border-b border-slate-200/70 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
                Making Sustainable Architecture
              </p>
              <h1 className="font-display text-2xl font-semibold text-slate-900 md:text-3xl">
                Envelope, light, and comfort.
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {viewTabs.map((tab) => {
                const isActive = viewMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`font-display text-base font-semibold ${
                      isActive
                        ? "border-b-2 border-slate-900 text-slate-900"
                        : "border-b-2 border-transparent text-slate-500 hover:border-slate-900 hover:text-slate-900"
                    }`}
                    onClick={() => setViewMode(tab.id)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] text-slate-600 md:text-xs md:leading-relaxed">
            Tweak glazing, shading, and ventilation for a {buildingWidth.toFixed(1)} m × {buildingDepth.toFixed(1)} m ×{" "}
            {buildingHeight.toFixed(1)} m room (internal dimensions). See how solar gains and heat losses evolve
            across the day and year.
          </p>
        </header>

        <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[minmax(0,1.65fr)_400px]">
          <div
            ref={mainCaptureRef}
            data-export-main-capture
            className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto lg:pr-2"
          >
            {viewMode === "explore" && (
              <>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.5fr)] lg:items-stretch">
                  <div data-export-model-panel className="flex h-full min-h-0 flex-col gap-4">
                    <BuildingPreview
                      faceConfigs={previewFaceConfigs}
                      snapshot={snapshot}
                      sunDirection={sunDirection}
                      outdoorTemp={outdoorTemp}
                      cloudCover={cloudCover}
                      ventilationLabel={ventilationLabel}
                      ventilationAch={achTotalAtTime}
                      buildingWidth={buildingWidth}
                      buildingDepth={buildingDepth}
                      buildingHeight={buildingHeight}
                      orientationDeg={orientationDeg}
                      captureMode={exportingVideo}
                      openWindowSegments={openWindowSegments}
                      onToggleWindowSegment={toggleWindowSegment}
                      onResizeWindowGlazing={handlePreviewFaceGlazingResize}
                      rooflightSpec={rooflightSpec}
                      rooflightEnabled={rooflightEnabled}
                      onToggleRooflight={toggleRooflightOpen}
                      downlightsOn={downlightsOn}
                      downlightIntensity={downlightIntensity}
                      downlightAngle={downlightBeamAngle}
                      downlightPenumbra={downlightPenumbra}
                      downlightThrowScale={downlightThrowScale}
                      downlightSourceGlow={downlightSourceGlow}
                      showMetrics={false}
                      size="compact"
                      stretch
                      className="flex-1"
                    />
                  </div>

                  <div className="flex h-full min-h-0 flex-col gap-1">
                    <Card
                      className={`relative z-0 info-popover-host p-3 ${
                        comfortStatus === "heating"
                          ? "!bg-sky-100"
                          : comfortStatus === "cooling"
                            ? "!bg-amber-100"
                            : "!bg-emerald-100"
                      }`}
                    >
                      <InfoPopover>
                        <p className="text-sm font-medium text-slate-800 mb-1">Comfort band</p>
                        <p className="text-xs text-slate-600">
                          Indoor temperature is compared against {COMFORT_BAND.min}–{COMFORT_BAND.max}°C to determine
                          whether heating or cooling would be needed.
                        </p>
                      </InfoPopover>
                      <p
                        className={`pr-8 text-xl font-semibold ${
                          comfortStatus === "heating"
                            ? "text-sky-800"
                            : comfortStatus === "cooling"
                              ? "text-amber-800"
                              : "text-emerald-800"
                        }`}
                      >
                        {comfortStatusLabel}
                      </p>
                      {ventilationComfort.apparentCoolingC >= 0.3 && (
                        <p className="pr-8 text-[11px] text-slate-600">
                          Draught-adjusted feel: {perceivedComfortLabel} at{" "}
                          {ventilationComfort.perceivedTempC.toFixed(1)}°C.
                        </p>
                      )}
                    </Card>
                    <div className="grid gap-1 sm:grid-cols-3 lg:grid-cols-1 lg:min-h-0">
                      <OutcomeCard
                        currentPoint={selectedPoint}
                        timeLabel={timeLabel}
                        dateLabel={selectedDateLabel}
                        outdoorTemp={outdoorTemp}
                        cloudCover={cloudCover}
                        compact
                        className="h-full min-h-0 p-2 space-y-1"
                        info={
                          <>
                            <p>
                              Indoor temperature is compared against the comfort band to show whether
                              heating or cooling would be needed.
                            </p>
                            <p className="mt-1">
                              Outdoor temperature reflects the selected hour. Measured weather shows cloud cover; simplified mode assumes clear sky.
                            </p>
                          </>
                        }
                      />
                      <GainsLossesCard
                        solarGain={solarGainNow}
                        heatLoss={snapshot.Q_loss_total}
                        solarHelper={
                          solarGainHelper === "Sun below horizon"
                            ? "Sun below horizon"
                            : "At selected hour"
                        }
                        compact
                        tight
                        className="min-h-0"
                        info={
                          <>
                            <p>
                              Solar gain is the heat entering through glazing at the selected hour.
                            </p>
                            <p className="mt-1">
                              Heat loss combines envelope + ventilation losses at the same hour.
                            </p>
                          </>
                        }
                      />
                      <div className="grid grid-cols-2 gap-1 min-h-0">
                        <VentilationCard
                          achTotal={achTotalAtTime}
                          ventilationLabel={ventilationLabel}
                          compact
                          tight
                          className="min-h-0"
                          info={(() => {
                            const opening = calculateOpeningArea(achTotalAtTime, buildingVolume);
                            return (
                              <>
                                <p>
                                  Fresh air rate is the total air changes per hour (ACH) from the chosen
                                  preset strategy, plus any clicked-open window sashes, including background infiltration.
                                </p>
                                {hasManualOpenWindows && (
                                  <p className="mt-2 text-xs text-slate-600">
                                    Clicked-open windows currently add{" "}
                                    <strong>{openedWindowArea.totalOpenAreaM2.toFixed(2)} m²</strong> free opening
                                    area ({openedWindowArea.topHungLeafCount} top-hung = {openedWindowArea.topHungAreaM2.toFixed(2)} m², {openedWindowArea.turnLeafCount} turn = {openedWindowArea.turnAreaM2.toFixed(2)} m²).
                                  </p>
                                )}
                                <p className="mt-2 text-xs text-slate-600">
                                  Rooflight free opening area is{" "}
                                  <strong>{effectiveRooflightOpeningAreaM2.toFixed(2)} m²</strong>{" "}
                                  {rooflightEnabled
                                    ? `(${rooflightSpec.width.toFixed(2)} × ${rooflightSpec.depth.toFixed(2)} m rooflight, open ${(effectiveRooflightOpenHeight * 1000).toFixed(0)} mm).`
                                    : `(rooflight OFF).`}
                                </p>
                                {hasManualOpenings && (
                                  <p className="mt-2 text-xs text-slate-600">
                                    Total manual openings are equivalent to about{" "}
                                    <strong>{openedWindowAch.toFixed(1)} ACH</strong> under a{" "}
                                    <strong>{manualWindowModeText}</strong> assumption.
                                  </p>
                                )}
                                <p className="mt-2 text-xs text-slate-600">
                                  <strong>{ventilationComfort.label}:</strong> apparent cooling is about{" "}
                                  <strong>{ventilationComfort.apparentCoolingC.toFixed(1)}°C</strong> at this time,
                                  so {indoorTempAtTime.toFixed(1)}°C air may feel closer to{" "}
                                  <strong>{ventilationComfort.perceivedTempC.toFixed(1)}°C</strong>.
                                </p>
                                {achTotalAtTime <= 0.3 ? (
                                  <p className="mt-2 text-xs text-slate-600">
                                    At {achTotalAtTime.toFixed(1)} ACH, this represents typical background
                                    infiltration through the building fabric (gaps, cracks, and services) rather
                                    than deliberate openable ventilation.
                                  </p>
                                ) : achTotalAtTime <= 0.6 ? (
                                  <p className="mt-2 text-xs text-slate-600">
                                    At {achTotalAtTime.toFixed(1)} ACH, this represents trickle ventilation through
                                    small permanent openings (e.g. trickle vents in window frames) rather than
                                    openable windows.
                                  </p>
                                ) : (
                                  <p className="mt-2 text-xs text-slate-600">
                                    For {achTotalAtTime.toFixed(1)} ACH with cross-ventilation, you would need
                                    roughly <strong>{opening.areaM2.toFixed(2)} m²</strong> of free opening area —
                                    equivalent to a window sash {opening.sashSideMm}mm × {opening.sashSideMm}mm fully
                                    open, or a 600mm × 600mm casement opened to ~{opening.casementPercent}%.
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        />
                        <IlluminanceCard
                          illuminance={snapshot.illuminanceLux}
                          compact
                          className="min-h-0"
                          info={
                            <>
                              <p>
                                Estimated natural light at a desk 2m from the window at the selected hour.
                              </p>
                              <p className="mt-1">
                                500+ lux is good for office tasks. Below 300 lux may require artificial lighting.
                              </p>
                            </>
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <Card
                    data-export-temp-chart-card
                    className="relative z-0 info-popover-host flex min-w-0 flex-col gap-3 p-4 lg:col-span-2"
                  >
                    <InfoPopover className="right-3 top-3">
                      <p>
                        Green line = indoor temperature. Blue dashed = outdoor temperature. Yellow
                        = solar gains (W).
                      </p>
                      <p className="mt-1">
                        Purple dashed = fresh air rate (ACH). Red = heat loss (W). When
                        indoor rises above outdoor, ventilation can help; large midday peaks suggest
                        glazing or shading issues.
                      </p>
                    </InfoPopover>
                    <div className="flex items-center">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-800">Daily Temperature Profile</p>
                        <p className="text-xs text-slate-500">{sunWindowLabel}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">{selectedHourRangeLabel}</p>
                      <div className="flex-1"></div>
                    </div>
                    <div
                      ref={dailyChartContainerRef}
                      data-export-temp-chart
                      className="h-44 min-w-0 md:h-52"
                    >
                      {chartData.length > 0 ? (
                        dailyChartSize.width > 0 && dailyChartSize.height > 0 && (
                          <LineChart
                            width={dailyChartSize.width}
                            height={dailyChartSize.height}
                            data={chartData}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            {Number.isFinite(selectedHour) && (
                              <ReferenceArea
                                x1={selectedHour}
                                x2={selectedHour + 1}
                                strokeOpacity={0}
                                fill="rgba(15, 23, 42, 0.08)"
                              />
                            )}
                            <XAxis
                              type="number"
                              dataKey="hour"
                              domain={[0, 24]}
                              ticks={dayHourTicks}
                              tickFormatter={(hour) => `${String(Math.round(hour)).padStart(2, "0")}:00`}
                              label={{ value: "Time of Day", position: "insideBottom", offset: -5, fontSize: 11, fill: "#64748b" }}
                            />
                            <YAxis domain={chartDomain} allowDecimals label={{ value: "Temperature (°C)", angle: -90, position: "insideLeft", fontSize: 11, fill: "#64748b" }} />
                            <YAxis yAxisId="solar" orientation="right" tickFormatter={(v) => `${Math.round(v)}`} label={{ value: "Solar Gain (W)", angle: 90, position: "insideRight", fontSize: 11, fill: "#64748b" }} />
                            <YAxis yAxisId="vent" hide domain={[0, ventChartDomainMax]} />
                            <YAxis yAxisId="heatLoss" hide domain={[0, 'auto']} />
                            <Tooltip
                              wrapperStyle={{ zIndex: 50 }}
                              formatter={(val, name) => {
                                if (name === "Room temperature" || name === "Outdoor temperature") {
                                  return `${Number(val).toFixed(1)}°C`;
                                }
                                if (name === "Solar gains") return `${Math.round(Number(val))} W`;
                                if (name === "Fresh air rate") {
                                  return `${Number(val).toFixed(2)} air changes per hour`;
                                }
                                if (name === "Heat loss") return `${Math.round(Number(val))} W`;
                                return `${Number(val).toFixed(0)}`;
                              }}
                              labelFormatter={(label) => {
                                const hourFloat = Number(label);
                                const hour = Math.floor(hourFloat);
                                const minute = Math.round((hourFloat - hour) * 60);
                                const displayHour = minute === 60 ? hour + 1 : hour;
                                const displayMinute = minute === 60 ? 0 : minute;
                                return `Time ${String(displayHour).padStart(2, "0")}:${String(displayMinute).padStart(2, "0")}`;
                              }}
                            />
                            <Legend />
                            <Line
                              dataKey="roomTemperature"
                              dot={false}
                              strokeWidth={2}
                              stroke="#0f766e"
                              name="Room temperature"
                            />
                            <Line
                              dataKey="outdoorTemperature"
                              dot={false}
                              strokeWidth={2}
                              strokeDasharray="6 4"
                              stroke="#2563eb"
                              name="Outdoor temperature"
                            />
                            <Line
                              yAxisId="solar"
                              dataKey="solarGain"
                              dot={false}
                              strokeWidth={2}
                              stroke="#f59e0b"
                              name="Solar gains"
                            />
                            <Line
                              yAxisId="vent"
                              dataKey="ventAch"
                              dot={false}
                              strokeWidth={2}
                              strokeDasharray="3 3"
                              stroke="#7c3aed"
                              name="Fresh air rate"
                            />
                            <Line
                              yAxisId="heatLoss"
                              dataKey="heatLoss"
                              dot={false}
                              strokeWidth={2}
                              stroke="#e11d48"
                              name="Heat loss"
                            />
                          </LineChart>
                        )
                      ) : (
                        <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
                          Move the sliders to explore how temperature changes through the day.
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                <details
                  ref={moreDetailsRef}
                  data-export-more-details
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                    More details
                  </summary>
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      {FACES.map((face) => (
                        <Metric
                          key={face.id}
                          label={`${face.label} solar gain`}
                          value={`${Math.round(snapshot.Q_solar_byFace[face.id])} W`}
                          accent={face.accent}
                        />
                      ))}
                      <Metric
                        key="rooflight-solar-gain"
                        label="Rooflight solar gain"
                        value={`${Math.round(snapshot.Q_solar_rooflight ?? 0)} W`}
                        accent="#f59e0b"
                      />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      <Metric
                        label="Total heat leaving"
                        value={`${Math.round(snapshot.Q_loss_total)} W`}
                        helper="All heat leaving the room at the selected hour"
                        accent="#e11d48"
                      />
                      <Metric
                        label="Heat through surfaces"
                        value={`${Math.round(snapshot.Q_loss_fabric)} W`}
                        helper={`Walls ${Math.round(snapshot.Q_loss_walls)} · Windows ${Math.round(snapshot.Q_loss_windows)} · Rooflight ${Math.round(snapshot.Q_loss_rooflight ?? 0)} · Roof ${Math.round(snapshot.Q_loss_roof)} · Floor ${Math.round(snapshot.Q_loss_floor)} W at the selected hour`}
                        accent="#be123c"
                      />
                      <Metric
                        label="Heat lost to fresh air"
                        value={`${Math.round(snapshot.Q_loss_vent)} W`}
                        helper="Heat carried out by fresh air at the selected hour"
                        accent="#9f1239"
                      />
                    </div>
                    <InsightsCard
                      snapshot={snapshot}
                      faceConfigs={faceState}
                      ventilationSummary={ventilationSummaryWithComfort}
                      dimensions={{
                        width: buildingWidth,
                        depth: buildingDepth,
                        height: buildingHeight,
                      }}
                    />
                  </div>
                </details>
              </>
            )}

            {viewMode === "explain" && (
              <>
                <BuildingPreview
                  faceConfigs={previewFaceConfigs}
                  snapshot={snapshot}
                  sunDirection={sunDirection}
                  outdoorTemp={outdoorTemp}
                  cloudCover={cloudCover}
                  ventilationLabel={ventilationLabel}
                  ventilationAch={achTotalAtTime}
                  buildingWidth={buildingWidth}
                  buildingDepth={buildingDepth}
                  buildingHeight={buildingHeight}
                  orientationDeg={orientationDeg}
                  captureMode={exportingVideo}
                  openWindowSegments={openWindowSegments}
                  onToggleWindowSegment={toggleWindowSegment}
                  onResizeWindowGlazing={handlePreviewFaceGlazingResize}
                  rooflightSpec={rooflightSpec}
                  rooflightEnabled={rooflightEnabled}
                  onToggleRooflight={toggleRooflightOpen}
                  downlightsOn={downlightsOn}
                  downlightIntensity={downlightIntensity}
                  downlightAngle={downlightBeamAngle}
                  downlightPenumbra={downlightPenumbra}
                  downlightThrowScale={downlightThrowScale}
                  downlightSourceGlow={downlightSourceGlow}
                />

                <InsightsCard
                  snapshot={snapshot}
                  faceConfigs={faceState}
                  ventilationSummary={ventilationSummaryWithComfort}
                  dimensions={{
                    width: buildingWidth,
                    depth: buildingDepth,
                    height: buildingHeight,
                  }}
                />

                <ComfortGuidanceCard
                  currentPoint={selectedPoint}
                  summary={daySummary}
                  comfortBand={COMFORT_BAND}
                  stepMinutes={daySimulation.stepMinutes}
                />

                <CostCarbonCard
                  title="Daily cost + carbon"
                  periodLabel={selectedDateLabel}
                  summary={dayCostSummary}
                />

                <Card className="space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">Daily Energy Balance</p>
                    {dayEnergyBreakdown && (
                      <p className="text-xs text-slate-500">
                        Solar {dayEnergyBreakdown.solarGainKWh.toFixed(1)} kWh · Losses {(dayEnergyBreakdown.fabricLossKWh + dayEnergyBreakdown.ventLossKWh).toFixed(1)} kWh
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">
                    Compares heat entering vs leaving the room over the selected day.
                  </p>
                  <details className="text-xs text-slate-500">
                    <summary className="cursor-pointer">What the colors mean</summary>
                    <p className="mt-2">
                      Solar gains (yellow) add heat. Envelope loss (red) is heat through walls, roof, floor, windows. Ventilation loss (purple) is heat carried out by fresh air.
                    </p>
                  </details>
                  <div className="h-44">
                    {dayEnergyBreakdown ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            {
                              category: "Selected day",
                              SolarGains: dayEnergyBreakdown.solarGainKWh,
                              EnvelopeLoss: dayEnergyBreakdown.fabricLossKWh,
                              VentilationLoss: dayEnergyBreakdown.ventLossKWh,
                            },
                          ]}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="category" />
                          <YAxis label={{ value: "Energy (kWh)", angle: -90, position: "insideLeft", fontSize: 11, fill: "#64748b" }} />
                          <Tooltip wrapperStyle={{ zIndex: 50 }} formatter={(val) => `${Number(val).toFixed(2)} kWh`} />
                          <Legend />
                          <Bar dataKey="SolarGains" fill="#f59e0b" />
                          <Bar dataKey="EnvelopeLoss" fill="#dc2626" />
                          <Bar dataKey="VentilationLoss" fill="#9333ea" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
                        Not enough timesteps for day energy breakdown.
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="space-y-3 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    What this model ignores
                  </p>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-slate-600">
                    <li>Humidity, latent loads, and PMV/PPD comfort effects.</li>
                    <li>Room-to-room heat transfer or distributed thermal mass.</li>
                    <li>Radiant asymmetry and mean radiant temperature effects.</li>
                    <li>Detailed HVAC controls, efficiency, and plant dynamics.</li>
                  </ul>
                </Card>

                <EnvelopeAssumptionsCard
                  uValues={activeUValues}
                  presetLabel={activeUPreset.label}
                  presetDetail={activeUPreset.detail}
                />

                <EnergyAssumptionsCard />
              </>
            )}

            {viewMode === "evaluate" && (
              <>
                <CostCarbonCard
                  title="Annual cost + carbon"
                  periodLabel="Full year (8,760 h)"
                  summary={annualCostSummary}
                />

                <Card className="space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">Annual Performance Summary</p>
                    <p className="text-xs text-slate-500">Full year simulation (8,760 hours)</p>
                  </div>
                  <p className="text-xs text-slate-600">
                    Annual comfort hours, overheating, and degree-hour loads for the current design.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <Metric label="Hours in comfort" value={`${Math.round(annualCurrent.metrics.hoursInComfort)} h`} />
                    <Metric label="Overheating > 26°C" value={`${Math.round(annualCurrent.metrics.overheatingHours26)} h`} accent="#b91c1c" />
                    <Metric label="Overheating > 28°C" value={`${Math.round(annualCurrent.metrics.overheatingHours28)} h`} accent="#991b1b" />
                    <Metric
                      label="Heating degree-hours"
                      value={`${Math.round(annualCurrent.metrics.heatingDegreeHours)} Kh`}
                      helper={`Below ${COMFORT_BAND.min}°C`}
                      accent="#1d4ed8"
                    />
                    <Metric
                      label="Cooling degree-hours"
                      value={`${Math.round(annualCurrent.metrics.coolingDegreeHours)} Kh`}
                      helper={`Above ${COMFORT_BAND.max}°C`}
                      accent="#c2410c"
                    />
                    <Metric
                      label="Peak indoor"
                      value={`${annualCurrent.metrics.peakIndoorTemp.toFixed(1)}°C`}
                      helper={formatMonthDayTime(annualCurrent.metrics.peakTime)}
                      accent="#7c2d12"
                    />
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold text-slate-700 mb-1">Indoor Temperature Distribution</p>
                      <p className="text-xs text-slate-500 mb-2">Hours spent at each temperature range.</p>
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={annualCurrent.histogram}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="band" minTickGap={8} label={{ value: "Temperature Range", position: "insideBottom", offset: -5, fontSize: 10, fill: "#64748b" }} />
                            <YAxis label={{ value: "Hours", angle: -90, position: "insideLeft", fontSize: 10, fill: "#64748b" }} />
                            <Tooltip wrapperStyle={{ zIndex: 50 }} formatter={(val) => `${Number(val).toFixed(0)} h`} />
                            <Bar dataKey="hours" fill="#0f766e" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold text-slate-700 mb-1">Monthly Overheating Hours</p>
                      <p className="text-xs text-slate-500 mb-2">Hours per month above comfort limits.</p>
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={annualCurrent.monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="month" label={{ value: "Month", position: "insideBottom", offset: -5, fontSize: 10, fill: "#64748b" }} />
                            <YAxis label={{ value: "Hours", angle: -90, position: "insideLeft", fontSize: 10, fill: "#64748b" }} />
                            <Tooltip wrapperStyle={{ zIndex: 50 }} formatter={(val) => `${Number(val).toFixed(0)} h`} />
                            <Legend />
                            <Bar dataKey="over26" fill="#ef4444" name=">26°C" />
                            <Bar dataKey="over28" fill="#991b1b" name=">28°C" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold text-slate-700">
                        Worst Overheating Week (Summer Stress Test)
                      </p>
                      <p className="text-xs text-slate-500 mb-1">
                        {annualCurrent.worstWeek.rangeLabel} · {annualCurrent.worstWeek.overheatingHours} hours above 26°C
                      </p>
                      <p className="text-xs text-slate-500 mb-2">
                        Shows the hottest week of the year. Red = indoor, blue = outdoor.
                      </p>
                      <div className="h-36">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={annualCurrent.worstWeek.series}>
                            <XAxis dataKey="clock" minTickGap={16} label={{ value: "Day & Time", position: "insideBottom", offset: -5, fontSize: 10, fill: "#64748b" }} />
                            <YAxis label={{ value: "°C", angle: -90, position: "insideLeft", fontSize: 10, fill: "#64748b" }} />
                            <Tooltip wrapperStyle={{ zIndex: 50 }} formatter={(val) => `${Number(val).toFixed(1)}°C`} />
                            <Legend />
                            <Line dataKey="T_in" dot={false} stroke="#b91c1c" name="Indoor" />
                            <Line dataKey="T_out" dot={false} stroke="#2563eb" name="Outdoor" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold text-slate-700">
                        Coldest Winter Week (Heating Demand Test)
                      </p>
                      <p className="text-xs text-slate-500 mb-1">
                        {annualCurrent.winterWeek.rangeLabel} · mean outdoor {annualCurrent.winterWeek.meanOutdoorC.toFixed(1)}°C
                      </p>
                      <p className="text-xs text-slate-500 mb-2">
                        Shows the coldest week. Green = indoor, blue = outdoor.
                      </p>
                      <div className="h-36">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={annualCurrent.winterWeek.series}>
                            <XAxis dataKey="clock" minTickGap={16} label={{ value: "Day & Time", position: "insideBottom", offset: -5, fontSize: 10, fill: "#64748b" }} />
                            <YAxis label={{ value: "°C", angle: -90, position: "insideLeft", fontSize: 10, fill: "#64748b" }} />
                            <Tooltip wrapperStyle={{ zIndex: 50 }} formatter={(val) => `${Number(val).toFixed(1)}°C`} />
                            <Legend />
                            <Line dataKey="T_in" dot={false} stroke="#0f766e" name="Indoor" />
                            <Line dataKey="T_out" dot={false} stroke="#1d4ed8" name="Outdoor" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>
          <div className="flex min-h-0 flex-col gap-4 lg:w-[400px] lg:max-w-[400px] lg:overflow-hidden">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1 lg:pr-2">
              {viewMode === "explore" && (
                <>
                  <Card className="space-y-4 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date & Time</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                        <span>Date</span>
                        <span>{selectedDateLabel}</span>
                      </div>
                      <div className="px-2">
                        <Slider
                          value={[dayOfYear]}
                          min={1}
                          max={DAYS_PER_YEAR}
                          step={1}
                          onValueChange={(v) => setDayOfYear(Math.round(v[0]))}
                        />
                      </div>
                      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                        {seasonalMarks.map((mark) => (
                          <button
                            key={mark.label}
                            type="button"
                            onClick={() => setDayOfYear(mark.day)}
                            className="text-[10px] text-slate-500 hover:text-slate-900 hover:underline"
                          >
                            {mark.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-medium text-slate-600">
                        <span>Time</span>
                        <span>{selectedHourRangeLabel}</span>
                      </div>
                      <div className="px-2">
                        <Slider
                          value={[timeFrac]}
                          min={0}
                          max={1}
                          step={1 / 24}
                          onValueChange={(v) => {
                            const raw = v?.[0];
                            if (!Number.isFinite(raw)) return;
                            const snapped = Math.round(raw * 24) / 24;
                            setTimeFrac(snapped);
                          }}
                        />
                      </div>
                    </div>
                  </Card>
                  <Card className="space-y-3 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Settings</p>
                  <div className="flex flex-wrap gap-2">
                    {exploreTabs.map((tab) => {
                      const isActive = exploreTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                            isActive
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                          onClick={() => setExploreTab(tab.id)}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    {exploreTab === "context" && (
                      <div className="space-y-2">
                        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-xs font-medium text-slate-600">Weather source</p>
                          <div className="flex flex-col gap-2">
                            <Button size="sm" variant="default" className="w-full justify-start" disabled>
                              Simplified (Pencilli - Brecon)
                            </Button>
                          </div>
                          <p className="text-xs text-slate-600">{weatherDescription}</p>
                          <p className="text-xs text-slate-500">
                            Compromise: this is not measured hourly weather, so cloud, wind, humidity and short-term
                            swings are simplified. Daytime peaks can run hotter than real conditions, but it is still
                            useful for highlighting likely overheating and underheating periods.
                          </p>
                          <p className="text-xs text-slate-500">
                            {Math.abs(weatherMeta.latitude).toFixed(3)}°{weatherMeta.latitude >= 0 ? "N" : "S"},{" "}
                            {Math.abs(weatherMeta.longitude).toFixed(3)}°{weatherMeta.longitude >= 0 ? "E" : "W"} ·
                            TZ {weatherMeta.tzHours >= 0 ? `+${weatherMeta.tzHours}` : weatherMeta.tzHours}
                          </p>
                        </div>
                        <div className="relative z-0 info-popover-host space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                          <InfoPopover className="right-2 top-2">
                            <p className="text-sm font-medium text-slate-800 mb-2">Orientation & facades</p>
                            <p className="text-xs text-slate-600 mb-2">
                              Facade controls are tied to the model faces (north/east/south/west). Changing
                              orientation rotates the whole building, so a “North” face points south at 180°.
                            </p>
                            <p className="text-xs text-slate-600">
                              Solar gains, shading, and heat loss use the rotated facing direction.
                            </p>
                          </InfoPopover>
                          <div className="flex items-center justify-between pr-6 text-xs font-medium text-slate-600">
                            <span>Orientation</span>
                            <span>{Math.round(orientationDeg)}°</span>
                          </div>
                          <Slider
                            value={[orientationDeg]}
                            min={0}
                            max={360}
                            step={1}
                            onValueChange={(v) => setOrientationDeg(v[0])}
                          />
                        </div>
                      </div>
                    )}

                    {exploreTab === "general" && (
                      <div className="space-y-2">
                        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-sm font-medium text-slate-800">Room dimensions (internal)</p>
                          <SliderField
                            label="Width"
                            value={buildingWidth}
                            onChange={setBuildingWidth}
                            min={2}
                            max={5}
                            step={0.1}
                            formatValue={(v) => `${v.toFixed(1)} m`}
                          />
                          <SliderField
                            label="Depth"
                            value={buildingDepth}
                            onChange={setBuildingDepth}
                            min={2}
                            max={5}
                            step={0.1}
                            formatValue={(v) => `${v.toFixed(1)} m`}
                          />
                          <SliderField
                            label="Floor-to-ceiling height"
                            value={buildingHeight}
                            onChange={setBuildingHeight}
                            min={2.1}
                            max={3.5}
                            step={0.1}
                            formatValue={(v) => `${v.toFixed(1)} m`}
                          />
                          <div className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                            Floor area {buildingFloorArea.toFixed(2)} m² · Volume {buildingVolume.toFixed(2)} m³
                          </div>
                        </div>
                        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-sm font-medium text-slate-800">Ceiling downlights (automatic)</p>
                          <SliderField
                            label="Brightness"
                            value={downlightIntensity}
                            onChange={setDownlightIntensity}
                            min={8}
                            max={120}
                            step={1}
                            formatValue={(v) => `${Math.round(v)}`}
                          />
                          <SliderField
                            label="Source glow"
                            value={downlightSourceGlow}
                            onChange={setDownlightSourceGlow}
                            min={0}
                            max={4}
                            step={0.05}
                            formatValue={(v) => `${v.toFixed(2)}x`}
                          />
                          <SliderField
                            label="Beam spread"
                            value={downlightBeamAngle}
                            onChange={setDownlightBeamAngle}
                            min={0.25}
                            max={0.95}
                            step={0.01}
                            formatValue={(v) => `${Math.round((v / 0.95) * 100)}%`}
                          />
                          <SliderField
                            label="Edge softness"
                            value={downlightPenumbra}
                            onChange={setDownlightPenumbra}
                            min={0.05}
                            max={1}
                            step={0.01}
                            formatValue={(v) => `${Math.round(v * 100)}%`}
                          />
                          <SliderField
                            label="Throw distance"
                            value={downlightThrowScale}
                            onChange={setDownlightThrowScale}
                            min={1}
                            max={4}
                            step={0.05}
                            formatValue={(v) => `${v.toFixed(2)}x room height`}
                          />
                          <p className="text-xs text-slate-500">
                            Auto mode: on when desk daylight is below {LUX_THRESHOLDS.adequate} lux, from 1 hour
                            before sunrise until {String(DOWNLIGHTS_OFF_HOUR).padStart(2, "0")}:00.
                          </p>
                          <p className="text-xs text-slate-600">
                            Status now:{" "}
                            <span className="font-semibold">{downlightsOn ? "On" : "Off"}</span> · Desk light{" "}
                            {Math.round(snapshot.illuminanceLux ?? 0)} lux.
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-sm font-medium text-slate-800">Warm-up period</p>
                          <p className="mt-1 text-xs text-slate-500">
                            The simulation runs for {SIMULATION_SPINUP_DAYS} days before your selected date so the room's thermal mass (walls, floor, furniture) reaches a realistic starting temperature.
                          </p>
                          <details className="mt-2 text-xs text-slate-500">
                            <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-800">Why is this needed?</summary>
                            <p className="mt-2 rounded bg-slate-50 p-2">
                              A real room doesn't start cold each morning — it carries heat from previous days. Heavy materials like concrete store heat and release it slowly. Without warm-up, the simulation would start at outdoor temperature at midnight, as if the building appeared from nowhere.
                            </p>
                          </details>
                        </div>
                      </div>
                    )}

                    {exploreTab === "glazing" && (
                      <div className="space-y-2">
                        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                          <SliderField
                            label="Total window width ratio"
                            value={overallWWR}
                            onChange={setOverallGlazing}
                            min={0}
                            max={0.8}
                            step={0.05}
                            formatValue={(v) => `${Math.round(v * 100)}%`}
                          />
                          <p className="text-xs text-slate-500">
                            Adjusting this resets per-face width ratios to an even split.
                          </p>
                          <p className="text-xs text-slate-500">
                            Effective total WWR (area-based): {Math.round(overallWWR * 100)}%.
                          </p>
                          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-700">
                                Flat rooflight (inside parapet)
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-600">On/off</span>
                                <Switch
                                  checked={rooflightEnabled}
                                  onCheckedChange={handleRooflightEnabledChange}
                                />
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              Starts at 1.00 × 1.00 m and can only expand. Maximum size keeps at least{" "}
                              {(ROOFLIGHT_MAX_EDGE_OFFSET_M * 1000).toFixed(0)} mm clearance to the inside parapet.
                              {rooflightEnabled
                                ? ` Click the rooflight in the model to open it by ${(WINDOW_OPEN_TRAVEL_M * 1000).toFixed(0)} mm.`
                                : " Rooflight is currently off."}
                            </p>
                            <SliderField
                              label="Rooflight width"
                              value={rooflightState.width}
                              onChange={(v) => handleRooflightSizeChange("width", v)}
                              min={rooflightSizeLimits.minSize}
                              max={rooflightSizeLimits.maxWidth}
                              step={0.01}
                              disabled={!rooflightEnabled}
                              formatValue={(v) => `${v.toFixed(2)} m`}
                            />
                            <SliderField
                              label="Rooflight depth"
                              value={rooflightState.depth}
                              onChange={(v) => handleRooflightSizeChange("depth", v)}
                              min={rooflightSizeLimits.minSize}
                              max={rooflightSizeLimits.maxDepth}
                              step={0.01}
                              disabled={!rooflightEnabled}
                              formatValue={(v) => `${v.toFixed(2)} m`}
                            />
                            <div className="rounded-md bg-slate-100 p-2 text-xs text-slate-600">
                              {rooflightEnabled
                                ? `Current rooflight ${rooflightSpec.width.toFixed(2)} × ${rooflightSpec.depth.toFixed(2)} m · opening ${Math.round(effectiveRooflightOpenHeight * 1000)} mm (${effectiveRooflightOpeningAreaM2.toFixed(2)} m² free area)`
                                : `Rooflight is off (no opening area, no rooflight solar/heat transfer contribution).`}
                            </div>
                          </div>
                          <div className="space-y-3">
                            {FACES.map((face) => {
                              const config = faceState[face.id];
                              const faceSpan =
                                face.id === "east" || face.id === "west"
                                  ? buildingDepth
                                  : buildingWidth;
                              const glazingRatio = Math.max(
                                0,
                                Math.min(0.8, config?.glazing ?? 0),
                              );
                              const maxCenterRatio = Math.max(0, 1 - glazingRatio);
                              const centerRatio = clampWindowCenterRatio(
                                glazingRatio,
                                config?.windowCenterRatio ?? 0,
                              );
                              const cillLift = config?.cillLift ?? 0;
                              const headDrop = config?.headDrop ?? 0;
                              const maxTotal = Math.max(
                                0,
                                buildingHeight - MIN_WINDOW_CLEAR_HEIGHT
                              );
                              const maxCillLift = Math.max(0, maxTotal - headDrop);
                              const maxHeadDrop = Math.max(0, maxTotal - cillLift);

                              return (
                                <div
                                  key={face.id}
                                  className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2"
                                >
                                  <p className="text-xs font-semibold text-slate-700">
                                    {face.label} window geometry{" "}
                                    <span className="text-[10px] font-normal text-slate-400">
                                      (Facing {faceFacingLabel(face)})
                                    </span>
                                  </p>
                                  <p className="text-[11px] text-slate-600">
                                    Effective {face.label} WWR:{" "}
                                    <span className="font-semibold text-slate-800">
                                      {Math.round((faceWWR[face.id] ?? 0) * 100)}%
                                    </span>
                                  </p>
                                  <SliderField
                                    label={`${face.label} glazing width ratio`}
                                    value={config.glazing}
                                    onChange={(v) => updateFace(face.id, "glazing", v)}
                                    min={0}
                                    max={0.8}
                                    step={0.05}
                                    formatValue={(v) => `${Math.round(v * 100)}%`}
                                  />
                                  <SliderField
                                    label="Horizontal offset"
                                    value={centerRatio}
                                    onChange={(v) => updateFace(face.id, "windowCenterRatio", v)}
                                    min={-maxCenterRatio}
                                    max={maxCenterRatio}
                                    step={0.01}
                                    formatValue={(v) => `${((v * faceSpan) / 2).toFixed(2)} m`}
                                  />
                                  <SliderField
                                    label="Cill lift"
                                    value={cillLift}
                                    onChange={(v) => handleFaceCillLiftChange(face.id, v)}
                                    min={0}
                                    max={maxCillLift}
                                    step={0.01}
                                    formatValue={(v) => `${v.toFixed(2)} m`}
                                  />
                                  <SliderField
                                    label="Head drop"
                                    value={headDrop}
                                    onChange={(v) => handleFaceHeadDropChange(face.id, v)}
                                    min={0}
                                    max={maxHeadDrop}
                                    step={0.01}
                                    formatValue={(v) => `${v.toFixed(2)} m`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-slate-500">
                            Cill/head controls are per facade. Minimum clear opening kept at{" "}
                            {MIN_WINDOW_CLEAR_HEIGHT.toFixed(2)} m.
                          </p>
                        </div>
                      </div>
                    )}

                    {exploreTab === "shading" && (
                      <div className="space-y-2">
                        {FACES.map((face) => {
                          const config = faceState[face.id];
                          if (config.glazing <= 0) return null;
                          return (
                            <div key={face.id} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-slate-700" style={{ color: face.accent }}>
                                  {face.label} face
                                </p>
                                <p className="text-[10px] font-medium text-slate-500">
                                  Facing {faceFacingLabel(face)}
                                </p>
                              </div>
                              <SliderField
                                label="Overhang ratio (d/h)"
                                value={config.overhang}
                                onChange={(v) => updateFace(face.id, "overhang", v)}
                                min={0}
                                max={0.5}
                                step={0.05}
                                formatValue={(v) => v.toFixed(2)}
                              />
                              <SliderField
                                label="Vertical fins"
                                value={config.fin}
                                onChange={(v) => updateFace(face.id, "fin", v)}
                                min={0}
                                max={1}
                                step={0.05}
                                formatValue={(v) => v.toFixed(2)}
                              />
                              <SliderField
                                label="Horizontal fins"
                                value={config.hFin}
                                onChange={(v) => updateFace(face.id, "hFin", v)}
                                min={0}
                                max={1}
                                step={0.05}
                                formatValue={(v) => v.toFixed(2)}
                              />
                            </div>
                          );
                        })}
                        {FACES.every((f) => faceState[f.id].glazing <= 0) && (
                          <p className="text-xs text-slate-500">
                            Add glazing to a face to see shading controls.
                          </p>
                        )}
                      </div>
                    )}

                    {exploreTab === "fabric" && (
                      <div className="space-y-2">
                        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-xs font-medium text-slate-600">U-value presets</p>
                          <div className="grid gap-2">
                            {U_VALUE_PRESET_ORDER.map((presetId) => {
                              const preset = U_VALUE_PRESETS[presetId];
                              return (
                                <Button
                                  key={presetId}
                                  size="sm"
                                  variant={uValuePreset === presetId ? "default" : "secondary"}
                                  className="w-full justify-start"
                                  onClick={() => setUValuePreset(presetId)}
                                >
                                  {preset.label}
                                </Button>
                              );
                            })}
                          </div>
                          <p className="text-xs text-slate-500">{activeUPreset.detail}</p>
                          <p className="text-xs text-slate-500">
                            Current U-values: walls {activeUValues.wall.toFixed(2)}, roof{" "}
                            {activeUValues.roof.toFixed(2)}, floor {activeUValues.floor.toFixed(2)}, windows{" "}
                            {activeUValues.window.toFixed(2)} W/m²K.
                          </p>
                        </div>
                      </div>
                    )}

                    {exploreTab === "ventilation" && (
                      <div className="space-y-2">
                        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-xs font-medium text-slate-600">Ventilation presets</p>
                          <div className="grid gap-2">
                            {VENTILATION_PRESET_ORDER.map((presetId) => {
                              const preset = VENTILATION_PRESETS[presetId];
                              return (
                                <div key={presetId} className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant={ventilationPreset === presetId ? "default" : "secondary"}
                                    className="flex-1 justify-start"
                                    onClick={() => setVentilationPreset(presetId)}
                                  >
                                    {preset.label}
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-xs text-slate-500">{activeVentPreset.detail}</p>
                          {!adaptiveVentEnabled && (
                            <p className="text-xs text-slate-500">
                              Current rate: {achTotalAtTime.toFixed(1)} air changes per hour (includes{" "}
                              {ACH_INFILTRATION_DEFAULT.toFixed(1)} background
                              {hasManualOpenings ? ` + ${openedWindowAch.toFixed(1)} from manual openings` : ""}).
                            </p>
                          )}
                          <p className="text-xs text-slate-500">
                            {ventilationComfortSummary}
                          </p>
                          <p className="text-xs text-slate-500">{ventilationWindAssumptionText}</p>
                          {hasManualOpenWindows && (
                            <p className="text-xs text-slate-500">
                              Clicked windows open area: {openedWindowArea.totalOpenAreaM2.toFixed(2)} m² across{" "}
                              {openedWindowArea.openLeafCount} sash
                              {openedWindowArea.openLeafCount === 1 ? "" : "es"} ({openedWindowArea.topHungLeafCount} top-hung = {openedWindowArea.topHungAreaM2.toFixed(2)} m², {openedWindowArea.turnLeafCount} turn = {openedWindowArea.turnAreaM2.toFixed(2)} m²; {manualWindowModeText}).
                            </p>
                          )}
                          <p className="text-xs text-slate-500">
                            {rooflightEnabled
                              ? `Rooflight: ${rooflightSpec.width.toFixed(2)} × ${rooflightSpec.depth.toFixed(2)} m, open ${Math.round(effectiveRooflightOpenHeight * 1000)} mm (${effectiveRooflightOpeningAreaM2.toFixed(2)} m² free area).`
                              : "Rooflight: OFF."}
                          </p>
                        </div>
                        <div className={`flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 ${adaptiveVentEnabled ? "opacity-50" : ""}`}>
                          <div>
                            <p className="text-sm font-medium text-slate-800">Night purge</p>
                            <p className="text-xs text-slate-500">
                              {adaptiveVentEnabled
                                ? "Adaptive mode handles night cooling automatically."
                                : `Boost to ${VENTILATION_PRESETS.purge.achTotal.toFixed(1)} air changes per hour between ${String(NIGHT_START_HOUR).padStart(2, "0")}:00-${String(NIGHT_END_HOUR).padStart(2, "0")}:00.`}
                            </p>
                          </div>
                          <Switch
                            checked={adaptiveVentEnabled || nightPurgeEnabled}
                            onCheckedChange={setNightPurgeEnabled}
                            disabled={adaptiveVentEnabled}
                          />
                        </div>
                      </div>
                    )}

                    {exploreTab === "export" && (
                      <div className="space-y-3">
                        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-sm font-medium text-slate-800">PNG snapshot</p>
                          <p className="text-xs text-slate-500">
                            Exports a single A4 front page with model, chart, details, and environmental settings.
                          </p>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={exportSnapshotPngs}
                            disabled={exportingPngs}
                          >
                            {exportingPngs ? "Exporting PNG..." : "Export PNG snapshot"}
                          </Button>
                        </div>

                        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-sm font-medium text-slate-800">24-hour video</p>
                          <p className="text-xs text-slate-500">
                            Records a 20 second video of the main view, entirely in the browser (no installs).
                          </p>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={exportDayVideo}
                            disabled={exportingVideo}
                          >
                            {exportingVideo ? "Rendering video..." : "Export 24 hour video"}
                          </Button>
                          {exportingVideo && (
                            <p className="text-xs text-slate-500">
                              Progress: {Math.round(exportProgress * 100)}%
                            </p>
                          )}
                          <p className="text-[11px] text-slate-400">
                            Outputs WebM (no installs required). Takes about 20 seconds.
                          </p>
                        </div>

                        {exportError && (
                          <p className="text-xs text-amber-700">{exportError}</p>
                        )}
                      </div>
                    )}
                  </div>

                </Card>
                </>
              )}

              {viewMode === "explain" && (
                <Card className="space-y-4 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Model scope
                  </p>
                  <p className="text-xs text-slate-600">
                    Single-zone 1R1C model using dry-bulb temperature only. Results are for learning and option comparison, not compliance.
                  </p>
                  <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs font-medium text-slate-600">Current inputs</p>
                    <p className="text-xs text-slate-500">
                    Weather {weatherSummary} · Date {selectedDateLabel} · Orientation {Math.round(orientationDeg)}° ·
                      WWR {Math.round(overallWWR * 100)}% · Envelope {activeUPreset.label}
                    </p>
                  </div>
                </Card>
              )}

            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
