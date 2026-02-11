import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { loadEpwDataset } from "@/weather/parseEpw";
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
  WEATHER_FILE_URL,
  LUX_THRESHOLDS,
  buildPreviewFaceConfigs,
  classifyIlluminance,
  buildWindowsFromFaceState,
  cardinalFromAzimuth,
  cloneFaceState,
  computeCostCarbonSummary,
  computeSnapshot,
  dateFromDayOfYearUTC,
  daySunTimes,
  deg2rad,
  forcingAt,
  formatClockTime,
  formatHourRange,
  formatMonthDay,
  formatMonthDayTime,
  isNightHour,
  normalizedAzimuth,
  simulateAnnual1R1C,
  simulateDay1R1C,
  uValuePresetLabel,
  validateEpwDataset,
  ventilationPresetLabel,
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

export default function App() {
  const initialSolsticeDay =
    DEFAULT_SITE.latitude >= 0 ? SUMMER_SOLSTICE_DAY : WINTER_SOLSTICE_DAY;
  const [faceState, setFaceState] = useState({
    north: { glazing: 0.5, overhang: 0, fin: 0, hFin: 0 },
    east: { glazing: 0.5, overhang: 0, fin: 0, hFin: 0 },
    south: { glazing: 0.5, overhang: 0, fin: 0, hFin: 0 },
    west: { glazing: 0.5, overhang: 0, fin: 0, hFin: 0 },
  });

  const updateFace = (faceId, field, value) => {
    setFaceState((prev) => ({
      ...prev,
      [faceId]: { ...prev[faceId], [field]: value },
    }));
  };

  const [orientationDeg, setOrientationDeg] = useState(0);
  const [viewMode, setViewMode] = useState("explore");
  const [exploreTab, setExploreTab] = useState("context");
  const [ventilationPreset, setVentilationPreset] = useState(DEFAULT_VENTILATION_PRESET);
  const [nightPurgeEnabled, setNightPurgeEnabled] = useState(false);
  const [uValuePreset, setUValuePreset] = useState(DEFAULT_U_VALUE_PRESET);
  const [weatherMode, setWeatherMode] = useState("epw");
  const [epwDataset, setEpwDataset] = useState(null);
  const [weatherWarning, setWeatherWarning] = useState("");
  const [dayOfYear, setDayOfYear] = useState(initialSolsticeDay);
  const [timeFrac, setTimeFrac] = useState(MIDDAY_TIME_FRAC);
  const [optionA, setOptionA] = useState(null);
  const [optionB, setOptionB] = useState(null);
  const [showCompare, setShowCompare] = useState(false);
  const [balancedOutEnabled, setBalancedOutEnabled] = useState(true);
  const [balancedOutDays, setBalancedOutDays] = useState(SIMULATION_SPINUP_DAYS);
  const [exportingVideo, setExportingVideo] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState("");
  const dateSliderWrapRef = useRef(null);
  const dateSliderRef = useRef(null);
  const [dateSliderMetrics, setDateSliderMetrics] = useState({ left: 0, width: 0 });

  const mainCaptureRef = useRef(null);
  const settingsCaptureRef = useRef(null);

  const faceFacingLabel = (face) => {
    const azimuth = normalizedAzimuth(face.azimuth + orientationDeg);
    const cardinal = cardinalFromAzimuth(azimuth);
    if (!cardinal) return `${Math.round(azimuth)}°`;
    const cardinalLabel = `${cardinal[0].toUpperCase()}${cardinal.slice(1)}`;
    return `${cardinalLabel} (${Math.round(azimuth)}°)`;
  };

  useEffect(() => {
    let active = true;

    loadEpwDataset(WEATHER_FILE_URL)
      .then((dataset) => {
        if (!active) return;
        if (dataset.hours.length !== 8760) {
          throw new Error(`Expected 8760 rows but got ${dataset.hours.length}.`);
        }

        const check = validateEpwDataset(dataset);
        console.info(
          "[EPW] GBR_WAL_Pencelli.Aux.036100_TMYx loaded:",
          `tDry ${check.stats.tMin.toFixed(1)} to ${check.stats.tMax.toFixed(1)} C,`,
          `GHI ${check.stats.ghiMin.toFixed(0)} to ${check.stats.ghiMax.toFixed(0)} Wh/m2`,
        );
        if (!check.seasonalCheckPass) {
          console.warn(
            `[EPW] Validation warning: January mean (${check.janMean.toFixed(1)} C) is not lower than July mean (${check.julMean.toFixed(1)} C).`,
          );
        }
        if (!check.middayPeakPass) {
          console.warn(
            `[EPW] Validation warning: midsummer GHI peak hour (${check.peak.hour}:00) is not near midday.`,
          );
        }

        setEpwDataset(dataset);
        setWeatherWarning("");
      })
      .catch((error) => {
        console.error("[EPW] Weather load failed, falling back to simplified demo weather.", error);
        if (!active) return;
        setEpwDataset(null);
        setWeatherWarning("Weather file failed to load - using simplified demo weather (clear-sky sunlight).");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setTimeFrac(MIDDAY_TIME_FRAC);
  }, [weatherMode]);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || typeof ResizeObserver === "undefined") return undefined;
    const wrap = dateSliderWrapRef.current;
    const slider = dateSliderRef.current;
    if (!wrap || !slider) return undefined;

    let lastLeft = null;
    let lastWidth = null;

    const update = () => {
      const wrapRect = wrap.getBoundingClientRect();
      const sliderRect = slider.getBoundingClientRect();
      const newLeft = sliderRect.left - wrapRect.left;
      const newWidth = sliderRect.width;
      // Only update state if values actually changed to prevent infinite loops
      if (newLeft !== lastLeft || newWidth !== lastWidth) {
        lastLeft = newLeft;
        lastWidth = newWidth;
        setDateSliderMetrics({ left: newLeft, width: newWidth });
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrap);
    observer.observe(slider);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const usingEpw = weatherMode === "epw" && Boolean(epwDataset);
  const effectiveWeatherMode = usingEpw ? "epw" : "synthetic";
  const weatherMeta = useMemo(() => {
    if (!usingEpw || !epwDataset) return DEFAULT_SITE;
    return {
      name: epwDataset.meta.name,
      latitude: epwDataset.meta.lat,
      longitude: epwDataset.meta.lon,
      tzHours: epwDataset.meta.tzHours,
      elevationM: epwDataset.meta.elevationM,
    };
  }, [usingEpw, epwDataset]);

  const weatherSummary = useMemo(() => {
    if (weatherMode === "epw" && usingEpw) {
      return "Pencelli (Brecon)";
    }
    if (weatherMode === "epw" && !weatherWarning) {
      return "Loading weather file...";
    }
    return "Simplified (demo)";
  }, [weatherMode, usingEpw, weatherWarning]);

  const seasonalMarks = useMemo(() => {
    const isNorthern = weatherMeta.latitude >= 0;
    const summerDay = isNorthern ? SUMMER_SOLSTICE_DAY : WINTER_SOLSTICE_DAY;
    const winterDay = isNorthern ? WINTER_SOLSTICE_DAY : SUMMER_SOLSTICE_DAY;
    const marchLabel = isNorthern ? "Spring equinox" : "Autumn equinox";
    const septLabel = isNorthern ? "Autumn equinox" : "Spring equinox";
    const positionFromDay = (day) =>
      ((day - 1) / (DAYS_PER_YEAR - 1)) * 100;
    const positionPxFromDay = (day) => {
      if (!dateSliderMetrics.width) return null;
      // Don't add dateSliderMetrics.left - the marker container uses absolute inset-0
      // which positions it at the wrapper's padding-box edge, same as the slider
      return (positionFromDay(day) / 100) * dateSliderMetrics.width;
    };
    const makeMark = (day, label) => ({
      day,
      label,
      dateLabel: formatMonthDay(dateFromDayOfYearUTC(day)),
      position: positionFromDay(day),
      positionPx: positionPxFromDay(day),
    });
    return [
      makeMark(summerDay, "Summer solstice"),
      makeMark(winterDay, "Winter solstice"),
      makeMark(SPRING_EQUINOX_DAY, marchLabel),
      makeMark(AUTUMN_EQUINOX_DAY, septLabel),
    ].sort((a, b) => a.day - b.day);
  }, [weatherMeta.latitude, dateSliderMetrics.left, dateSliderMetrics.width]);

  const weatherDescription = useMemo(() => {
    if (weatherMode === "epw" && usingEpw) {
      return "Real hourly weather file: measured temperature + sunlight; cloud effects already included.";
    }
    if (weatherMode === "epw" && !weatherWarning) {
      return "Loading the Pencelli (Brecon) weather file.";
    }
    return "Simplified temperature curve with clear-sky sunlight. Not real weather; no cloud data (demo/fallback).";
  }, [weatherMode, usingEpw, weatherWarning]);

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
  const effectiveSpinupDays = useMemo(
    () => (balancedOutEnabled ? Math.max(0, Math.round(balancedOutDays)) : 0),
    [balancedOutEnabled, balancedOutDays],
  );

  const windows = useMemo(
    () => buildWindowsFromFaceState(faceState, orientationDeg),
    [faceState, orientationDeg],
  );
  const previewFaceConfigs = useMemo(
    () => buildPreviewFaceConfigs(faceState),
    [faceState],
  );
  const totalGlazingArea = useMemo(
    () =>
      FACES.reduce((sum, f) => {
        const faceSpan = f.id === "east" || f.id === "west" ? BUILDING_DEPTH : BUILDING_WIDTH;
        return sum + faceSpan * faceState[f.id].glazing * BUILDING_HEIGHT;
      }, 0),
    [faceState],
  );
  const totalWallArea = 2 * (BUILDING_WIDTH + BUILDING_DEPTH) * BUILDING_HEIGHT;
  const overallWWR = totalGlazingArea / totalWallArea;

  const setOverallGlazing = (value) => {
    const clamped = Math.max(0, Math.min(0.8, value));
    setFaceState((prev) => {
      const next = { ...prev };
      FACES.forEach((face) => {
        next[face.id] = { ...prev[face.id], glazing: clamped };
      });
      return next;
    });
  };

  const baseParamsTemplate = useMemo(
    () => ({
      width: BUILDING_WIDTH,
      depth: BUILDING_DEPTH,
      height: BUILDING_HEIGHT,
      U_wall: activeUValues.wall,
      U_window: activeUValues.window,
      U_roof: activeUValues.roof,
      U_floor: activeUValues.floor,
      autoBlinds: false,
      blindsThreshold: 400,
      blindsReduction: 0.5,
      g_glass: 0.4, // Low-E glazing (was 0.6 for standard glazing)
      Q_internal: 180,
      latitude: weatherMeta.latitude,
      longitude: weatherMeta.longitude,
      timezoneHours: weatherMeta.tzHours,
      groundAlbedo: 0.25,
    }),
    [activeUValues, weatherMeta.latitude, weatherMeta.longitude, weatherMeta.tzHours],
  );
  const baseParams = useMemo(
    () => ({ ...baseParamsTemplate, windows }),
    [baseParamsTemplate, windows],
  );

  const weatherProvider = useMemo(
    () => ({
      mode: effectiveWeatherMode,
      dataset: usingEpw ? epwDataset : null,
      syntheticProfile: SYNTHETIC_PROFILE,
    }),
    [effectiveWeatherMode, usingEpw, epwDataset],
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
        nightPurgeEnabled,
        adaptiveVentEnabled,
      }),
    [baseParams, selectedDate, weatherProvider, ventilationAchTotal, nightPurgeEnabled, adaptiveVentEnabled, effectiveSpinupDays],
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
  const achTotalAtTime = selectedPoint?.achTotal ?? ventilationAchTotal;
  const adaptiveReason = selectedPoint?.adaptiveReason;
  const ventilationLabel = adaptiveVentEnabled
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
  const ventilationSummary = adaptiveVentEnabled
    ? `Adaptive ventilation: windows open automatically when cooling is beneficial (0.6-6.0 ACH).`
    : nightPurgeEnabled
      ? `${activeVentPreset.label} by day, night purge at ${VENTILATION_PRESETS.purge.achTotal.toFixed(1)} air changes per hour (22:00-06:00).`
      : `${activeVentPreset.label} (${ventilationAchTotal.toFixed(1)} air changes per hour).`;

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
  const escapeCsvValue = (value) => {
    const str = value === null || value === undefined ? "" : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, "\"\"")}"` : str;
  };
  const formatNumber = (value, digits = 3) =>
    Number.isFinite(value) ? Number(value).toFixed(digits) : "";
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

  const getSettingsCaptureTarget = () => settingsCaptureRef.current;

  const buildSettingsExport = () => ({
    generatedAt: new Date().toISOString(),
    app: "room-comfort-sim",
    weather: {
      mode: weatherMode,
      effectiveMode: effectiveWeatherMode,
      usingEpw,
      warning: weatherWarning || null,
      summary: weatherSummary,
      description: weatherDescription,
      location: weatherMeta,
    },
    selectedDate: {
      dayOfYear,
      dateUTC: selectedDate.toISOString().slice(0, 10),
      timeFraction: timeFrac,
      timeUTC: dateAtTime.toISOString(),
      timeLabel,
    },
    inputs: {
      orientationDeg,
      faceState,
      overallWWR,
      uValuePreset,
      ventilationPreset,
      nightPurgeEnabled,
      balancedOutEnabled,
      balancedOutDays,
      effectiveSpinupDays,
    },
    derived: {
      activeUValues,
      ventilationAchTotal,
      adaptiveVentEnabled,
    },
    dailySummary: daySummary,
    dailyCostSummary: dayCostSummary,
    annualCostSummary,
  });

  const exportSettingsJson = () => {
    const payload = buildSettingsExport();
    downloadFile(
      `room-comfort-settings-${formatDateStamp(selectedDate)}-${formatExportStamp()}.json`,
      `${JSON.stringify(payload, null, 2)}\n`,
      "application/json",
    );
  };

  const buildDayCsv = () => {
    const header = [
      "index",
      "time_utc",
      "time_label",
      "T_in_C",
      "T_out_C",
      "Q_solar_W",
      "Q_loss_fabric_W",
      "Q_loss_vent_W",
      "status",
      "heating_W",
      "cooling_W",
      "ach_total",
      "vent_active",
      "illuminance_lux",
      "wind_ms",
    ];
    const rows = daySeries.map((point, idx) => [
      idx,
      point.time?.toISOString?.() ?? "",
      point.timeLabel ?? "",
      formatNumber(point.T_in, 2),
      formatNumber(point.T_out, 2),
      formatNumber(point.Q_solar, 2),
      formatNumber(point.Q_loss_fabric, 2),
      formatNumber(point.Q_loss_vent, 2),
      point.status ?? "",
      formatNumber(point.heatingW, 2),
      formatNumber(point.coolingW, 2),
      formatNumber(point.achTotal, 3),
      point.ventActive ? 1 : 0,
      formatNumber(point.illuminanceLux, 1),
      formatNumber(point.windMS, 2),
    ]);
    return [header, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  };

  const exportDayCsv = () => {
    if (daySeries.length === 0) return;
    const csv = buildDayCsv();
    downloadFile(
      `room-comfort-day-${formatDateStamp(selectedDate)}-${formatExportStamp()}.csv`,
      `${csv}\n`,
      "text/csv",
    );
  };

  const exportAnnualJson = () => {
    if (!annualCurrent) return;
    const payload = {
      generatedAt: new Date().toISOString(),
      metrics: {
        ...annualCurrent.metrics,
        peakTime: annualCurrent.metrics.peakTime?.toISOString?.() ?? null,
      },
      histogram: annualCurrent.histogram,
      monthlyData: annualCurrent.monthlyData,
      worstWeek: annualCurrent.worstWeek,
      winterWeek: annualCurrent.winterWeek,
    };
    downloadFile(
      `room-comfort-annual-${formatDateStamp(selectedDate)}-${formatExportStamp()}.json`,
      `${JSON.stringify(payload, null, 2)}\n`,
      "application/json",
    );
  };

  const exportSettingsPdf = async () => {
    if (exportingPdf) return;
    const target = getSettingsCaptureTarget();
    if (!target) return;
    setExportingPdf(true);
    setExportError("");
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      await waitForNextFrame();
      const canvas = await html2canvas(target, {
        backgroundColor: "#f5f3ee",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const isLandscape = canvas.width >= canvas.height;
      const pdf = new jsPDF({
        orientation: isLandscape ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(canvas, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`room-comfort-settings-${formatDateStamp(selectedDate)}-${formatExportStamp()}.pdf`);
    } catch (error) {
      console.error("[Export] PDF failed:", error);
      setExportError("PDF export failed. Please try again.");
    } finally {
      setExportingPdf(false);
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

  const currentDesign = useMemo(
    () => ({
      faceState: cloneFaceState(faceState),
      orientationDeg,
      ventilationPreset,
      nightPurgeEnabled,
      uValuePreset,
    }),
    [faceState, orientationDeg, ventilationPreset, nightPurgeEnabled, uValuePreset],
  );

  const annualCurrent = useMemo(
    () =>
      simulateAnnual1R1C(baseParams, weatherProvider, {
        comfortBand: COMFORT_BAND,
        thermalCapacitance: THERMAL_CAPACITANCE_J_PER_K,
        achTotal: ventilationAchTotal,
        nightPurgeEnabled,
        adaptiveVentEnabled,
        spinupHours: effectiveSpinupDays * 24,
      }),
    [baseParams, weatherProvider, ventilationAchTotal, nightPurgeEnabled, adaptiveVentEnabled, effectiveSpinupDays],
  );

  const annualCostSummary = useMemo(() => {
    if (!annualCurrent) return null;
    return computeCostCarbonSummary({
      heatingThermalKWh: annualCurrent.metrics.heatingEnergyKWh,
      coolingThermalKWh: annualCurrent.metrics.coolingEnergyKWh,
      days: DAYS_PER_YEAR,
    });
  }, [annualCurrent]);

  const annualA = useMemo(() => {
    if (!optionA) return null;
    const presetA = U_VALUE_PRESETS[optionA.uValuePreset] ?? U_VALUE_PRESETS[DEFAULT_U_VALUE_PRESET];
    const ventPresetA =
      VENTILATION_PRESETS[optionA.ventilationPreset] ??
      VENTILATION_PRESETS[DEFAULT_VENTILATION_PRESET];
    const paramsA = {
      ...baseParamsTemplate,
      U_wall: presetA.values.wall,
      U_window: presetA.values.window,
      U_roof: presetA.values.roof,
      U_floor: presetA.values.floor,
      windows: buildWindowsFromFaceState(optionA.faceState, optionA.orientationDeg),
    };
    return simulateAnnual1R1C(paramsA, weatherProvider, {
      comfortBand: COMFORT_BAND,
      thermalCapacitance: THERMAL_CAPACITANCE_J_PER_K,
      achTotal: ventPresetA.achTotal,
      nightPurgeEnabled: optionA.nightPurgeEnabled ?? false,
      adaptiveVentEnabled: ventPresetA.isAdaptive === true,
      spinupHours: effectiveSpinupDays * 24,
    });
  }, [optionA, baseParamsTemplate, weatherProvider, effectiveSpinupDays]);

  const annualB = useMemo(() => {
    if (!optionB) return null;
    const presetB = U_VALUE_PRESETS[optionB.uValuePreset] ?? U_VALUE_PRESETS[DEFAULT_U_VALUE_PRESET];
    const ventPresetB =
      VENTILATION_PRESETS[optionB.ventilationPreset] ??
      VENTILATION_PRESETS[DEFAULT_VENTILATION_PRESET];
    const paramsB = {
      ...baseParamsTemplate,
      U_wall: presetB.values.wall,
      U_window: presetB.values.window,
      U_roof: presetB.values.roof,
      U_floor: presetB.values.floor,
      windows: buildWindowsFromFaceState(optionB.faceState, optionB.orientationDeg),
    };
    return simulateAnnual1R1C(paramsB, weatherProvider, {
      comfortBand: COMFORT_BAND,
      thermalCapacitance: THERMAL_CAPACITANCE_J_PER_K,
      achTotal: ventPresetB.achTotal,
      nightPurgeEnabled: optionB.nightPurgeEnabled ?? false,
      adaptiveVentEnabled: ventPresetB.isAdaptive === true,
      spinupHours: effectiveSpinupDays * 24,
    });
  }, [optionB, baseParamsTemplate, weatherProvider, effectiveSpinupDays]);

  useEffect(() => {
    if (!optionA || !optionB) setShowCompare(false);
  }, [optionA, optionB]);

  const comparisonRows = useMemo(() => {
    if (!annualA || !annualB) return [];
    const a = annualA.metrics;
    const b = annualB.metrics;
    return [
      { label: "Hours in comfort", a: a.hoursInComfort, b: b.hoursInComfort, unit: "h" },
      { label: "Overheating > 26°C", a: a.overheatingHours26, b: b.overheatingHours26, unit: "h" },
      { label: "Heating degree-hours", a: a.heatingDegreeHours, b: b.heatingDegreeHours, unit: "Kh" },
      { label: "Cooling degree-hours", a: a.coolingDegreeHours, b: b.coolingDegreeHours, unit: "Kh" },
    ];
  }, [annualA, annualB]);

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
            Tweak glazing, shading, and ventilation for a 4.8 m × 2.4 m room. See how solar gains and
            heat losses evolve across the day and year.
          </p>
        </header>

        <div className="grid flex-1 min-h-0 gap-4 lg:grid-cols-[minmax(0,1.65fr)_400px]">
          <div
            ref={mainCaptureRef}
            className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto lg:pr-2"
          >
            {viewMode === "explore" && (
              <>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.5fr)] lg:items-stretch">
                  <div className="flex h-full min-h-0 flex-col gap-4">
                    <BuildingPreview
                      faceConfigs={previewFaceConfigs}
                      snapshot={snapshot}
                      sunDirection={sunDirection}
                      outdoorTemp={outdoorTemp}
                      cloudCover={cloudCover}
                      ventilationLabel={ventilationLabel}
                      ventilationAch={achTotalAtTime}
                      orientationDeg={orientationDeg}
                      captureMode={exportingVideo}
                      showMetrics={false}
                      size="compact"
                      stretch
                      className="flex-1"
                    />
                  </div>

                  <div className="flex h-full min-h-0 flex-col gap-1">
                    <Card
                      className={`relative z-0 info-popover-host p-3 ${
                        selectedPoint?.status === "heating"
                          ? "!bg-sky-100"
                          : selectedPoint?.status === "cooling"
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
                          selectedPoint?.status === "heating"
                            ? "text-sky-800"
                            : selectedPoint?.status === "cooling"
                              ? "text-amber-800"
                              : "text-emerald-800"
                        }`}
                      >
                        {selectedPoint?.status === "heating"
                          ? "Below comfort"
                          : selectedPoint?.status === "cooling"
                            ? "Above comfort"
                            : "Within comfort"}
                      </p>
                    </Card>
                    <div className="grid gap-1 sm:grid-cols-3 lg:grid-cols-1 lg:min-h-0">
                      <OutcomeCard
                        currentPoint={selectedPoint}
                        comfortBand={COMFORT_BAND}
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
                          info={
                            <p>
                              Fresh air rate is the total air changes per hour (ACH) from the chosen
                              preset, including background infiltration.
                            </p>
                          }
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

                  <Card className="relative z-0 info-popover-host flex flex-col gap-3 p-4 lg:col-span-2">
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
                    <div className="h-44 md:h-52">
                      {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData}>
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
                            <YAxis yAxisId="vent" hide domain={[0, MAX_VENTILATION_ACH + 0.5]} />
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
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
                          Move the sliders to explore how temperature changes through the day.
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                <details className="rounded-lg border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                    More details
                  </summary>
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 md:grid-cols-4">
                      {FACES.map((face) => (
                        <Metric
                          key={face.id}
                          label={`${face.label} solar gain`}
                          value={`${Math.round(snapshot.Q_solar_byFace[face.id])} W`}
                          accent={face.accent}
                        />
                      ))}
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
                        helper={`Walls ${Math.round(snapshot.Q_loss_walls)} · Windows ${Math.round(snapshot.Q_loss_windows)} · Roof ${Math.round(snapshot.Q_loss_roof)} · Floor ${Math.round(snapshot.Q_loss_floor)} W at the selected hour`}
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
                      ventilationSummary={ventilationSummary}
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
                  orientationDeg={orientationDeg}
                  captureMode={exportingVideo}
                />

                <InsightsCard
                  snapshot={snapshot}
                  faceConfigs={faceState}
                  ventilationSummary={ventilationSummary}
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
                <Card className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      A vs B delta
                    </p>
                    <p className="text-[10px] text-slate-500">4 key metrics</p>
                  </div>
                  {!optionA || !optionB ? (
                    <p className="text-xs text-slate-500">
                      Save the current design as A and B to compare annual performance.
                    </p>
                  ) : null}
                  {optionA && optionB && !showCompare ? (
                    <p className="text-xs text-slate-500">
                      Click “Compare A vs B” to reveal the deltas.
                    </p>
                  ) : null}
                  {showCompare && annualA && annualB && (
                    <div className="space-y-2 text-sm text-slate-700">
                      {comparisonRows.map((row) => {
                        const delta = row.b - row.a;
                        const sign = delta > 0 ? "+" : "";
                        return (
                          <div key={row.label} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                            <span>{row.label}</span>
                            <span className="font-mono text-xs">
                              A {row.a.toFixed(1)} · B {row.b.toFixed(1)} · Δ {sign}{delta.toFixed(1)} {row.unit}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

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
          <div
            ref={settingsCaptureRef}
            className="flex min-h-0 flex-col gap-4 lg:w-[400px] lg:max-w-[400px] lg:overflow-hidden"
          >
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
                      <div className="pb-6">
                        <div className="relative px-2" ref={dateSliderWrapRef}>
                          <Slider
                            ref={dateSliderRef}
                            className="relative z-10"
                            value={[dayOfYear]}
                            min={1}
                            max={DAYS_PER_YEAR}
                            step={1}
                            onValueChange={(v) => setDayOfYear(Math.round(v[0]))}
                          />
                          <div className="pointer-events-none absolute left-2 right-2 top-1/2 h-2 -translate-y-1/2">
                            {seasonalMarks.map((mark) => (
                              <button
                                key={mark.label}
                                type="button"
                                onClick={() => setDayOfYear(mark.day)}
                                className="group pointer-events-auto absolute -translate-x-1/2 text-left"
                                style={{ left: `${mark.position}%` }}
                              >
                                <span className="pointer-events-none block h-3 w-px bg-slate-400/70" />
                                <span className="mt-1 block whitespace-nowrap text-[9px] font-semibold text-slate-500 transition-colors group-hover:text-slate-700">
                                  {mark.label}
                                </span>
                                <span className="block whitespace-nowrap text-[9px] text-slate-400 transition-colors group-hover:text-slate-500">
                                  {mark.dateLabel}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
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
                            <Button
                              size="sm"
                              variant={weatherMode === "epw" ? "default" : "secondary"}
                              className="w-full justify-start"
                              onClick={() => setWeatherMode("epw")}
                            >
                              Pencelli (Brecon)
                            </Button>
                            <Button
                              size="sm"
                              variant={weatherMode === "synthetic" ? "default" : "secondary"}
                              className="w-full justify-start"
                              onClick={() => setWeatherMode("synthetic")}
                            >
                              Simplified (demo)
                            </Button>
                          </div>
                          <p className="text-xs text-slate-600">{weatherDescription}</p>
                          <p className="text-xs text-slate-500">
                            {Math.abs(weatherMeta.latitude).toFixed(3)}°{weatherMeta.latitude >= 0 ? "N" : "S"},{" "}
                            {Math.abs(weatherMeta.longitude).toFixed(3)}°{weatherMeta.longitude >= 0 ? "E" : "W"} ·
                            TZ {weatherMeta.tzHours >= 0 ? `+${weatherMeta.tzHours}` : weatherMeta.tzHours}
                          </p>
                          {weatherMode === "epw" && !epwDataset && !weatherWarning && (
                            <p className="text-xs text-slate-500">Loading weather file...</p>
                          )}
                          {weatherWarning && <p className="text-xs text-amber-700">{weatherWarning}</p>}
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
                        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                          <div>
                            <p className="text-sm font-medium text-slate-800">Warm-up period</p>
                            <p className="text-xs text-slate-500">
                              Simulate previous days so the room starts at a realistic temperature.
                            </p>
                          </div>
                          <Switch checked={balancedOutEnabled} onCheckedChange={setBalancedOutEnabled} />
                        </div>
                        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                          <SliderField
                            label="Warm-up days"
                            value={balancedOutDays}
                            onChange={(value) => setBalancedOutDays(Math.round(value))}
                            min={0}
                            max={20}
                            step={1}
                            disabled={!balancedOutEnabled}
                            formatValue={(v) => `${Math.round(v)} days`}
                          />
                          <p className="text-xs text-slate-500">
                            {balancedOutEnabled && balancedOutDays > 0 ? (
                              <>Simulates {Math.round(balancedOutDays)} day(s) before your selected date, so the room's thermal mass (walls, floor, furniture) has time to absorb or release heat realistically.</>
                            ) : (
                              <>Without warm-up, the room starts at outdoor temperature at midnight — as if the building appeared from nowhere. This underestimates how warm (or cool) the room would actually be.</>
                            )}
                          </p>
                          <details className="text-xs text-slate-500">
                            <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-800">Why does this matter?</summary>
                            <p className="mt-2 rounded bg-slate-50 p-2">
                              A real room doesn't start cold each morning — it carries heat from previous days. Heavy materials like concrete store heat and release it slowly. With high glazing and low ventilation, a room can accumulate heat over several days like a greenhouse. Try 7+ days to see the realistic steady-state temperature.
                            </p>
                          </details>
                        </div>
                      </div>
                    )}

                    {exploreTab === "glazing" && (
                      <div className="space-y-2">
                        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                          <SliderField
                            label="Total window-to-wall ratio"
                            value={overallWWR}
                            onChange={setOverallGlazing}
                            min={0}
                            max={0.8}
                            step={0.05}
                            formatValue={(v) => `${Math.round(v * 100)}%`}
                          />
                          <p className="text-xs text-slate-500">
                            Adjusting this resets per-face glazing to an even split.
                          </p>
                          <div className="space-y-3">
                            {FACES.map((face) => (
                              <SliderField
                                key={face.id}
                                label={
                                  <span>
                                    {face.label} glazing{" "}
                                    <span className="text-[10px] font-normal text-slate-400">
                                      (Facing {faceFacingLabel(face)})
                                    </span>
                                  </span>
                                }
                                value={faceState[face.id].glazing}
                                onChange={(v) => updateFace(face.id, "glazing", v)}
                                min={0}
                                max={0.8}
                                step={0.05}
                                formatValue={(v) => `${Math.round(v * 100)}%`}
                              />
                            ))}
                          </div>
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
                              Current rate: {ventilationAchTotal.toFixed(1)} air changes per hour (includes{" "}
                              {ACH_INFILTRATION_DEFAULT.toFixed(1)} background).
                            </p>
                          )}
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
                          <p className="text-sm font-medium text-slate-800">Data exports</p>
                          <p className="text-xs text-slate-500">
                            Exports the current inputs and the latest simulation outputs.
                          </p>
                          <div className="grid gap-2">
                            <Button size="sm" variant="secondary" onClick={exportSettingsJson}>
                              Export settings (JSON)
                            </Button>
                            <Button size="sm" variant="secondary" onClick={exportDayCsv}>
                              Export day series (CSV)
                            </Button>
                            <Button size="sm" variant="secondary" onClick={exportAnnualJson}>
                              Export annual summary (JSON)
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-sm font-medium text-slate-800">PDF snapshot</p>
                          <p className="text-xs text-slate-500">
                            Captures the settings panel exactly as shown.
                          </p>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={exportSettingsPdf}
                            disabled={exportingPdf}
                          >
                            {exportingPdf ? "Exporting PDF..." : "Export PDF snapshot"}
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

              {viewMode === "evaluate" && (
                <Card className="space-y-4 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Compare options
                  </p>
                  <div className="grid gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setOptionA(currentDesign)}>
                      Save current as A
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setOptionB(currentDesign)}>
                      Save current as B
                    </Button>
                    <Button
                      size="sm"
                      variant={showCompare ? "default" : "secondary"}
                      disabled={!optionA || !optionB}
                      onClick={() => setShowCompare((prev) => !prev)}
                    >
                      Compare A vs B
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    A: {optionA ? `orient ${Math.round(optionA.orientationDeg)}°, ventilation ${ventilationPresetLabel(optionA.ventilationPreset)}${optionA.nightPurgeEnabled ? " + night purge" : ""}, envelope ${uValuePresetLabel(optionA.uValuePreset)}` : "not set"}
                  </p>
                  <p className="text-xs text-slate-500">
                    B: {optionB ? `orient ${Math.round(optionB.orientationDeg)}°, ventilation ${ventilationPresetLabel(optionB.ventilationPreset)}${optionB.nightPurgeEnabled ? " + night purge" : ""}, envelope ${uValuePresetLabel(optionB.uValuePreset)}` : "not set"}
                  </p>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
