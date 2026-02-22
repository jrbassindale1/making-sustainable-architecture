import { useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { InfoPopover } from "@/components/ui/info-popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, Sankey, Tooltip as RechartsTooltip } from "recharts";
import {
  ACH_INFILTRATION_DEFAULT,
  BUILDING_DEPTH,
  BUILDING_HEIGHT,
  BUILDING_WIDTH,
  CARBON_FACTORS,
  COOLING_SYSTEM,
  ENERGY_TARIFFS,
  FACES,
  HEATING_SYSTEM,
  LETI_TARGETS,
  DEFAULT_LETI_TARGET,
  PRICE_CAP_PERIOD_LABEL,
  formatGBP,
  formatKg,
  formatPence,
} from "@/engine";

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  unit,
  disabled,
  formatValue,
}) {
  const display = disabled
    ? "—"
    : formatValue
      ? formatValue(value)
      : `${value.toFixed(2)}${unit}`;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium text-slate-600">
        <span>{label}</span>
        <span>{display}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(v) => onChange(v[0])}
      />
    </div>
  );
}

export function Metric({ label, value, helper, accent }) {
  const accentColor = accent ?? "#0f766e";
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200/70 bg-white p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)]">
      <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: accentColor }} />
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="font-display mt-2 text-3xl font-semibold" style={{ color: accentColor }}>
        {value}
      </p>
      {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
    </div>
  );
}

/* -------------------- Insights -------------------- */
export function InsightsCard({ snapshot, faceConfigs, ventilationSummary, dimensions }) {
  const width = Number.isFinite(dimensions?.width) ? dimensions.width : BUILDING_WIDTH;
  const depth = Number.isFinite(dimensions?.depth) ? dimensions.depth : BUILDING_DEPTH;
  const height = Number.isFinite(dimensions?.height) ? dimensions.height : BUILDING_HEIGHT;
  const sunUp = snapshot.altitude > 0;
  const byFace = snapshot.Q_solar_byFace;
  const totalFacadeSolarGain = Object.values(byFace || {}).reduce((sum, value) => sum + (value || 0), 0);

  const sorted = Object.entries(byFace).sort(([, a], [, b]) => b - a);
  const dominantFace = sorted[0];

  const orientationSentence = !sunUp
    ? "The sun is below the horizon right now — slide to daylight to see how each face performs."
    : dominantFace[1] > 0
      ? `The ${dominantFace[0]} face is receiving the most solar gain (${Math.round(dominantFace[1])} W). ` +
        `Total solar gain across all faces is ${Math.round(totalFacadeSolarGain)} W.`
      : "No direct solar gain on any face at this time.";

  const shadedFaces = FACES.filter(
    (f) =>
      faceConfigs[f.id].glazing > 0 &&
      (faceConfigs[f.id].overhang > 0.1 || faceConfigs[f.id].fin > 0.05),
  );
  const shadingSentence =
    shadedFaces.length === 0
      ? "No external shading is applied to any face. Consider adding overhangs to reduce peak solar gains."
      : `External shading is active on the ${shadedFaces.map((f) => f.label).join(", ")} face${shadedFaces.length > 1 ? "s" : ""}.`;

  const totalGlazingArea = FACES.reduce((sum, f) => {
    const faceSpan = f.id === "east" || f.id === "west" ? depth : width;
    return sum + faceSpan * faceConfigs[f.id].glazing * height;
  }, 0);
  const totalWallArea = 2 * (width + depth) * height;
  const overallWWR = totalGlazingArea / totalWallArea;
  const glazingSentence = `Overall window-to-wall ratio is ${Math.round(overallWWR * 100)}% (${totalGlazingArea.toFixed(1)} m² of glazing across ${totalWallArea.toFixed(0)} m² of facade).`;

  const ventSentence = ventilationSummary;

  return (
    <Card className="space-y-3 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Design insights
      </p>
      <div className="space-y-2 text-sm leading-snug text-slate-600">
        <p>
          <span className="font-semibold text-slate-800">Orientation:</span> {orientationSentence}
        </p>
        <p>
          <span className="font-semibold text-slate-800">Shading:</span> {shadingSentence}
        </p>
        <p>
          <span className="font-semibold text-slate-800">Glazing:</span> {glazingSentence}
        </p>
        <p>
          <span className="font-semibold text-slate-800">Ventilation:</span> {ventSentence}
        </p>
      </div>
    </Card>
  );
}

export function OutcomeCard({
  currentPoint,
  timeLabel,
  dateLabel,
  outdoorTemp,
  cloudCover,
  compact = false,
  className,
  info,
}) {
  if (!currentPoint) return null;

  const isHeating = currentPoint.status === "heating";
  const isCooling = currentPoint.status === "cooling";
  const tempColor = isHeating
    ? "text-amber-700"
    : isCooling
      ? "text-sky-700"
      : "text-emerald-700";

  const cloudLabel = cloudCover !== undefined
    ? `Cloud cover ${Math.round(cloudCover * 10)}%`
    : "Clear-sky sunlight (no cloud data)";

  const containerClass = compact ? "space-y-1.5 p-2.5" : "space-y-3 p-5";
  const valueClass = compact ? "text-xl" : "text-3xl";

  return (
    <Card className={cn(containerClass, info && "relative z-0 info-popover-host", className)}>
      {info && <InfoPopover>{info}</InfoPopover>}
      <p className={cn("text-sm font-semibold uppercase tracking-wide text-slate-500", info && "pr-7")}>Outcome</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">Indoor</p>
          <p className={`${valueClass} font-semibold ${tempColor}`}>
            {currentPoint.T_in.toFixed(1)}°C
          </p>
          {compact && (
            <p className="text-[11px] leading-tight text-slate-500">
              {dateLabel} · {timeLabel}
            </p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500">Outdoor</p>
          <p className={`${valueClass} font-semibold text-blue-600`}>
            {outdoorTemp?.toFixed(1) ?? "—"}°C
          </p>
          {compact ? (
            <p className="text-[11px] leading-tight text-slate-500">
              {cloudLabel}
            </p>
          ) : (
            <p className="text-xs text-slate-500">{cloudLabel}</p>
          )}
        </div>
      </div>
      {!compact && (
        <p className="text-xs text-slate-500">
          {dateLabel} · {timeLabel}
        </p>
      )}
    </Card>
  );
}

export function GainsLossesCard({
  solarGain,
  heatLoss,
  solarHelper,
  compact = false,
  tight = false,
  className,
  info,
}) {
  const isTight = compact && tight;
  const containerClass = isTight
    ? "space-y-1 p-2"
    : compact
      ? "space-y-1.5 p-3"
      : "space-y-3 p-5";
  const valueClass = isTight ? "text-lg" : compact ? "text-xl" : "text-3xl";
  const labelClass = isTight ? "text-[10px]" : "text-xs";
  const helperClass = isTight ? "text-[10px]" : "text-xs";

  return (
    <Card className={cn(containerClass, info && "relative z-0 info-popover-host", className)}>
      {info && <InfoPopover>{info}</InfoPopover>}
      <p className={`${labelClass} font-semibold uppercase tracking-wide text-slate-500`}>
        Heat balance
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className={`${labelClass} font-medium text-slate-500`}>Solar gain</p>
          <p className={`${valueClass} font-semibold text-amber-500`}>
            +{Math.round(solarGain)} W
          </p>
          <p className={`${helperClass} text-slate-500`}>{solarHelper}</p>
        </div>
        <div>
          <p className={`${labelClass} font-medium text-slate-500`}>Heat loss</p>
          <p className={`${valueClass} font-semibold text-rose-600`}>
            −{Math.round(heatLoss)} W
          </p>
          <p className={`${helperClass} text-slate-500`}>Through envelope + air</p>
        </div>
      </div>
    </Card>
  );
}

const ENERGY_FLOW_COLORS = Object.freeze({
  room: "#0f766e",
  solar: "#f59e0b",
  internal: "#a855f7",
  heating: "#fb7185",
  ingress: "#3b82f6",
  walls: "#be123c",
  windows: "#e11d48",
  rooflight: "#db2777",
  roof: "#9f1239",
  floor: "#881337",
  ventilation: "#2563eb",
  cooling: "#0ea5e9",
});
const MIN_FLOW_RENDER_W = 0.5;
const HVAC_FLOW_VISIBILITY_W = 0.05;
const BUILDING_SECTION_WIDTH = 224;
const BUILDING_SECTION_HEIGHT_MIN = 118;
const BUILDING_SECTION_HEIGHT_MAX = 168;
const BUILDING_WALL_THICKNESS = 8.5;
const FLOW_INTERIOR_PADDING = 4;
const FLOW_EDGE_GUARD = 14;
const FLOW_SIDE_SEPARATION_X = 28;
const FLOW_LANE_GAP = 7;
const FLOW_MIN_HALF_WIDTH = 0.75;
const FLOW_LABEL_VALUE_OFFSET_Y = 11;
const ENERGY_FLOW_CHART_HEIGHT = 320; // Matches h-80
const ENERGY_FLOW_SANKEY_MARGIN = Object.freeze({
  top: 24,
  right: 162,
  bottom: 40,
  left: 162,
});
const toPositiveW = (value) => (Number.isFinite(value) ? Math.max(0, value) : 0);
const toIngressW = (value) => (Number.isFinite(value) && value < 0 ? Math.abs(value) : 0);

function buildEnergyFlowData({
  snapshot,
  internalGain,
  heatingW,
  coolingW,
}) {
  const conductiveComponents = [
    { key: "walls", value: snapshot?.Q_loss_walls },
    { key: "windows", value: snapshot?.Q_loss_windows },
    { key: "rooflight", value: snapshot?.Q_loss_rooflight },
    { key: "roof", value: snapshot?.Q_loss_roof },
    { key: "floor", value: snapshot?.Q_loss_floor },
    { key: "ventilation", value: snapshot?.Q_loss_vent },
  ];

  const ingressW = conductiveComponents.reduce((sum, component) => sum + toIngressW(component.value), 0);
  const incoming = [
    {
      label: "Solar gains",
      value: toPositiveW(snapshot?.Q_solar),
      color: ENERGY_FLOW_COLORS.solar,
      flowType: "solar",
    },
    {
      label: "Internal gains",
      value: toPositiveW(internalGain),
      color: ENERGY_FLOW_COLORS.internal,
      flowType: "internal",
    },
    {
      label: "Heating",
      value: toPositiveW(heatingW),
      color: ENERGY_FLOW_COLORS.heating,
      flowType: "heating",
    },
  ];
  if (ingressW > MIN_FLOW_RENDER_W) {
    incoming.push({
      label: "Outdoor heat ingress",
      value: ingressW,
      color: ENERGY_FLOW_COLORS.ingress,
      flowType: "ingress",
    });
  }

  const fabricBreakdown = {
    walls: toPositiveW(snapshot?.Q_loss_walls),
    windows: toPositiveW(snapshot?.Q_loss_windows),
    rooflight: toPositiveW(snapshot?.Q_loss_rooflight),
    roof: toPositiveW(snapshot?.Q_loss_roof),
    floor: toPositiveW(snapshot?.Q_loss_floor),
  };
  const fabricLossW = Object.values(fabricBreakdown).reduce((sum, value) => sum + value, 0);
  const outgoing = [
    {
      label: "Fabric losses",
      value: fabricLossW,
      color: ENERGY_FLOW_COLORS.walls,
      flowType: "fabric",
    },
    {
      label: "Ventilation",
      value: toPositiveW(snapshot?.Q_loss_vent),
      color: ENERGY_FLOW_COLORS.ventilation,
      flowType: "ventilation",
    },
    {
      label: "Cooling",
      value: toPositiveW(coolingW),
      color: ENERGY_FLOW_COLORS.cooling,
      flowType: "cooling",
    },
  ];

  const thresholdForItem = (item) =>
    item?.flowType === "heating" || item?.flowType === "cooling"
      ? HVAC_FLOW_VISIBILITY_W
      : MIN_FLOW_RENDER_W;
  const visibleIncoming = incoming
    .filter((item) => item.value > thresholdForItem(item));
  const visibleOutgoing = outgoing
    .filter((item) => item.value > thresholdForItem(item));
  const totalInW = visibleIncoming.reduce((sum, item) => sum + item.value, 0);
  const totalOutW = visibleOutgoing.reduce((sum, item) => sum + item.value, 0);
  const nodes = [{
    name: "Building",
    fill: ENERGY_FLOW_COLORS.room,
    type: "building",
    windowLossW: fabricBreakdown.windows,
    rooflightLossW: fabricBreakdown.rooflight,
  }];
  const links = [];

  visibleIncoming.forEach((item, laneIndex) => {
    const sourceIndex = nodes.push({
      name: item.label,
      fill: item.color,
      type: item.flowType === "internal" ? "internal-input" : "input",
    }) - 1;
    links.push({
      source: sourceIndex,
      target: 0,
      value: item.value,
      color: item.color,
      flowType: item.flowType,
      flowSide: "incoming",
      laneIndex,
      laneCount: visibleIncoming.length,
      sideValues: visibleIncoming.map((entry) => entry.value),
    });
  });
  visibleOutgoing.forEach((item, laneIndex) => {
    const targetIndex = nodes.push({ name: item.label, fill: item.color, type: "output" }) - 1;
    links.push({
      source: 0,
      target: targetIndex,
      value: item.value,
      color: item.color,
      flowType: item.flowType,
      flowSide: "outgoing",
      laneIndex,
      laneCount: visibleOutgoing.length,
      sideValues: visibleOutgoing.map((entry) => entry.value),
    });
  });

  return {
    incoming: visibleIncoming,
    outgoing: visibleOutgoing,
    sankeyData: { nodes, links },
    totalInW,
    totalOutW,
    storageW: totalInW - totalOutW,
    hasIngress: ingressW > MIN_FLOW_RENDER_W,
    fabricBreakdown,
  };
}

function resolveBuildingSectionGeometryFromFrame(frame) {
  const x = Number.isFinite(frame?.x) ? frame.x : 0;
  const y = Number.isFinite(frame?.y) ? frame.y : 0;
  const width = Number.isFinite(frame?.width) ? frame.width : 0;
  const height = Number.isFinite(frame?.height) ? frame.height : 0;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const sectionWidth = BUILDING_SECTION_WIDTH;
  const sectionHeight = Math.max(
    BUILDING_SECTION_HEIGHT_MIN,
    Math.min(BUILDING_SECTION_HEIGHT_MAX, height * 0.98),
  );
  const leftX = centerX - sectionWidth / 2;
  const rightX = centerX + sectionWidth / 2;
  const topY = centerY - sectionHeight / 2;
  const bottomY = centerY + sectionHeight / 2;
  return { leftX, rightX, topY, bottomY, centerX, centerY, sectionHeight };
}

function resolvePinnedBuildingFrame(nodeLike, buildingAnchorRef, sankeyMargin) {
  if (!nodeLike) return null;
  const x = Number.isFinite(nodeLike?.x) ? nodeLike.x : 0;
  const y = Number.isFinite(nodeLike?.y) ? nodeLike.y : 0;
  const width = Number.isFinite(nodeLike?.width) ? nodeLike.width : 0;
  const height = Number.isFinite(nodeLike?.height) ? nodeLike.height : 0;

  const measuredChartHeight = Number.isFinite(buildingAnchorRef?.current?.chartHeight)
    ? buildingAnchorRef.current.chartHeight
    : null;
  const chartHeight = measuredChartHeight ?? ENERGY_FLOW_CHART_HEIGHT;

  const marginTop = Number.isFinite(sankeyMargin?.top) ? sankeyMargin.top : 0;
  const marginBottom = Number.isFinite(sankeyMargin?.bottom) ? sankeyMargin.bottom : 0;
  const sectionHeight = Math.max(
    BUILDING_SECTION_HEIGHT_MIN,
    Math.min(BUILDING_SECTION_HEIGHT_MAX, height * 0.98),
  );
  const desiredSectionBottomY = chartHeight - marginBottom - 8;
  const desiredSectionCenterY = desiredSectionBottomY - sectionHeight / 2;
  const anchoredY = Math.max(marginTop, desiredSectionCenterY - height / 2);
  return { x, y: anchoredY, width, height };
}

function resolveNodeFlowCenterYFromPayload(payload, isRightNode) {
  const candidateLink = isRightNode
    ? Array.isArray(payload?.targetLinks) ? payload.targetLinks[0] : null
    : Array.isArray(payload?.sourceLinks) ? payload.sourceLinks[0] : null;
  if (!candidateLink) return null;
  const candidates = isRightNode
    ? [candidateLink.targetY, candidateLink.y1, candidateLink.ty, candidateLink.y]
    : [candidateLink.sourceY, candidateLink.y0, candidateLink.sy, candidateLink.y];
  const resolved = candidates.find((value) => Number.isFinite(value));
  return Number.isFinite(resolved) ? resolved : null;
}

function renderEnergySankeyNode({ x, y, width, height, payload }, buildingAnchorRef, sankeyMargin) {
  const isBuildingNode = payload?.type === "building" || payload?.name === "Building";
  const isInternalInputNode = payload?.type === "internal-input";
  const buildingFrame = isBuildingNode
    ? resolvePinnedBuildingFrame({ x, y, width, height }, buildingAnchorRef, sankeyMargin)
    : null;
  const drawX = buildingFrame?.x ?? x;
  const drawY = buildingFrame?.y ?? y;
  const drawWidth = buildingFrame?.width ?? width;
  const drawHeight = buildingFrame?.height ?? height;
  const isRightNode = Array.isArray(payload?.targetLinks) && payload.targetLinks.length === 0;
  const anchoredBuildingSection = buildingAnchorRef?.current?.buildingSection;
  const flowCenterMap = buildingAnchorRef?.current?.flowCenterYByNodeName;
  const alignedFlowCenterY = !isBuildingNode && !isInternalInputNode
    ? Number.isFinite(flowCenterMap?.[payload?.name])
      ? flowCenterMap[payload.name]
      : resolveNodeFlowCenterYFromPayload(payload, isRightNode)
    : null;
  const labelX = isBuildingNode
    ? drawX + drawWidth / 2
    : isInternalInputNode && anchoredBuildingSection
      ? anchoredBuildingSection.centerX + 16
      : isRightNode
        ? x + width + 8
        : x - 8;
  const labelAnchor = isBuildingNode
    ? "middle"
    : isInternalInputNode && anchoredBuildingSection
      ? "start"
      : isRightNode
        ? "start"
        : "end";
  const labelY = isBuildingNode
    ? drawY - 86
    : isInternalInputNode && anchoredBuildingSection
      ? anchoredBuildingSection.bottomY + 20
      : Number.isFinite(alignedFlowCenterY)
        ? alignedFlowCenterY
        : y + height / 2;
  const valueY = isInternalInputNode && anchoredBuildingSection
    ? anchoredBuildingSection.bottomY + 31
    : Number.isFinite(alignedFlowCenterY)
      ? alignedFlowCenterY + FLOW_LABEL_VALUE_OFFSET_Y
      : y + height / 2 + FLOW_LABEL_VALUE_OFFSET_Y;
  const nodeValueW = Number.isFinite(payload?.value) ? Math.round(payload.value) : null;
  const rooflightLossW = Number.isFinite(payload?.rooflightLossW) ? Math.round(payload.rooflightLossW) : 0;

  return (
    <g>
      {isBuildingNode && (
        <>
          {(() => {
            const centerX = drawX + drawWidth / 2;
            const centerY = drawY + drawHeight / 2;
            const sectionWidth = BUILDING_SECTION_WIDTH;
            const sectionHeight = Math.max(
              BUILDING_SECTION_HEIGHT_MIN,
              Math.min(BUILDING_SECTION_HEIGHT_MAX, drawHeight * 0.98),
            );
            const wallThickness = BUILDING_WALL_THICKNESS;
            const parapetRise = 14;
            const leftX = centerX - sectionWidth / 2;
            const rightX = centerX + sectionWidth / 2;
            const topY = centerY - sectionHeight / 2;
            const bottomY = centerY + sectionHeight / 2;
            if (buildingAnchorRef?.current) {
              buildingAnchorRef.current = {
                ...buildingAnchorRef.current,
                buildingSection: { leftX, rightX, topY, bottomY, centerX, centerY, sectionHeight },
              };
            }
            const groundY = bottomY + 10;
            const clearWallHeight = bottomY - topY;
            const windowW = Math.max(2.6, wallThickness - 1.2);
            const windowH = Math.max(40, Math.min(clearWallHeight * 0.66, clearWallHeight - 20));
            const windowY = topY + (clearWallHeight - windowH) / 2;
            const windowBottomY = windowY + windowH;
            const leftWindowX = leftX - wallThickness / 2 + 0.6;
            const rightWindowX = rightX - wallThickness / 2 + 0.6;
            const rooflightW = 20;
            const rooflightH = Math.max(3.2, wallThickness - 1.6);
            const rooflightX = centerX - rooflightW / 2;
            const rooflightY = topY - rooflightH / 2;
            const rooflightRightX = rooflightX + rooflightW;
            const rooflightCenterX = rooflightX + rooflightW / 2;
            const roofArrowHalfWidth = Math.max(2.6, Math.min(8.8, 1.4 + rooflightLossW * 0.03));
            const roofArrowLength = Math.max(26, Math.min(44, 22 + rooflightLossW * 0.08));
            const roofArrowHeadHeight = Math.max(7, Math.min(13, roofArrowHalfWidth * 1.8));
            const roofArrowCutoutHeight = Math.max(5, Math.min(10, roofArrowHalfWidth * 1.6));
            const roofArrowBaseY = rooflightY + rooflightH / 2;
            const roofArrowStemTopY = roofArrowBaseY - roofArrowLength + roofArrowHeadHeight;
            const roofArrowTipY = roofArrowBaseY - roofArrowLength;
            const insulationOffset = 9;
            const roofLeftX = leftX + wallThickness / 2;
            const roofRightX = rightX - wallThickness / 2;
            const insulationOuterLeftX = leftX - insulationOffset;
            const insulationOuterRightX = rightX + insulationOffset;
            const insulationInnerLeftX = roofLeftX + insulationOffset;
            const insulationInnerRightX = roofRightX - insulationOffset;
            const insulationParapetTopY = topY - parapetRise - insulationOffset;
            const insulationRoofY = topY - insulationOffset;
            const insulationBaseY = bottomY + insulationOffset;
            const insulationPath = [
              `M${insulationOuterLeftX},${insulationBaseY}`,
              `L${insulationOuterLeftX},${insulationParapetTopY}`,
              `L${insulationInnerLeftX},${insulationParapetTopY}`,
              `L${insulationInnerLeftX},${insulationRoofY}`,
              `L${insulationInnerRightX},${insulationRoofY}`,
              `L${insulationInnerRightX},${insulationParapetTopY}`,
              `L${insulationOuterRightX},${insulationParapetTopY}`,
              `L${insulationOuterRightX},${insulationBaseY}`,
              "Z",
            ].join(" ");

            return (
              <g>
                <path
                  d={insulationPath}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.2"
                  strokeOpacity={0.55}
                  strokeDasharray="4 3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <rect
                  x={leftX}
                  y={topY}
                  width={sectionWidth}
                  height={sectionHeight}
                  fill="transparent"
                  stroke="none"
                />
                <line
                  x1={leftX + wallThickness / 2}
                  y1={topY}
                  x2={rooflightX}
                  y2={topY}
                  stroke="#334155"
                  strokeWidth={wallThickness}
                />
                <line
                  x1={rooflightRightX}
                  y1={topY}
                  x2={rightX - wallThickness / 2}
                  y2={topY}
                  stroke="#334155"
                  strokeWidth={wallThickness}
                />
                <line
                  x1={leftX}
                  y1={topY - parapetRise}
                  x2={leftX}
                  y2={windowY}
                  stroke="#334155"
                  strokeWidth={wallThickness}
                />
                <line
                  x1={leftX}
                  y1={windowBottomY}
                  x2={leftX}
                  y2={bottomY}
                  stroke="#334155"
                  strokeWidth={wallThickness}
                />
                <line
                  x1={rightX}
                  y1={topY - parapetRise}
                  x2={rightX}
                  y2={windowY}
                  stroke="#334155"
                  strokeWidth={wallThickness}
                />
                <line
                  x1={rightX}
                  y1={windowBottomY}
                  x2={rightX}
                  y2={bottomY}
                  stroke="#334155"
                  strokeWidth={wallThickness}
                />
                <line x1={leftX} y1={bottomY} x2={rightX} y2={bottomY} stroke="#334155" strokeWidth={wallThickness} />
                <line
                  x1={leftX - 42}
                  y1={groundY}
                  x2={rightX + 60}
                  y2={groundY}
                  stroke="#334155"
                  strokeWidth="4"
                  strokeLinecap="round"
                />

                <rect
                  x={leftWindowX}
                  y={windowY}
                  width={windowW}
                  height={windowH}
                  fill="transparent"
                  stroke="#64748b"
                  strokeWidth="0.8"
                />
                <rect
                  x={rightWindowX}
                  y={windowY}
                  width={windowW}
                  height={windowH}
                  fill="transparent"
                  stroke="#64748b"
                  strokeWidth="0.8"
                />
                <rect
                  x={rooflightX}
                  y={rooflightY}
                  width={rooflightW}
                  height={rooflightH}
                  fill="transparent"
                  stroke="#64748b"
                  strokeWidth="0.8"
                />
                {rooflightLossW > 0 && (
                  <>
                    <path
                      d={`M${rooflightCenterX - roofArrowHalfWidth},${roofArrowBaseY} L${rooflightCenterX - roofArrowHalfWidth},${roofArrowStemTopY} L${rooflightCenterX + roofArrowHalfWidth},${roofArrowStemTopY} L${rooflightCenterX + roofArrowHalfWidth},${roofArrowBaseY} Z`}
                      fill={ENERGY_FLOW_COLORS.rooflight}
                      fillOpacity={0.62}
                      stroke="none"
                    />
                    <path
                      d={`M${rooflightCenterX - roofArrowHalfWidth},${roofArrowBaseY} L${rooflightCenterX + roofArrowHalfWidth},${roofArrowBaseY} L${rooflightCenterX},${roofArrowBaseY - roofArrowCutoutHeight} Z`}
                      fill="#ffffff"
                      fillOpacity={1}
                      stroke="none"
                    />
                    <path
                      d={`M${rooflightCenterX},${roofArrowTipY} L${rooflightCenterX - roofArrowHalfWidth},${roofArrowStemTopY} L${rooflightCenterX + roofArrowHalfWidth},${roofArrowStemTopY} Z`}
                      fill={ENERGY_FLOW_COLORS.rooflight}
                      fillOpacity={0.62}
                      stroke="none"
                    />
                    <text
                      x={rooflightCenterX + roofArrowHalfWidth + 6}
                      y={roofArrowTipY - 1}
                      dominantBaseline="middle"
                      fontSize={9}
                      fill="#9d174d"
                    >
                      Rooflight fabric loss {rooflightLossW} W
                    </text>
                  </>
                )}
              </g>
            );
          })()}
        </>
      )}
      <rect
        x={drawX}
        y={drawY}
        width={drawWidth}
        height={drawHeight}
        rx={3}
        fill="transparent"
        stroke="none"
        strokeOpacity={0}
      />
      {!isBuildingNode && (
        <text
          x={labelX}
          y={labelY}
          textAnchor={labelAnchor}
          dominantBaseline="middle"
          fontSize={11}
          fill="#334155"
        >
          {payload?.name}
        </text>
      )}
      {!isBuildingNode && nodeValueW !== null && (
        <text
          x={labelX}
          y={valueY}
          textAnchor={labelAnchor}
          dominantBaseline="middle"
          fontSize={10}
          fill="#64748b"
        >
          {nodeValueW} W
        </text>
      )}
    </g>
  );
}

function renderEnergySankeyLink({
  sourceX,
  targetX,
  sourceY,
  targetY,
  sourceControlX,
  targetControlX,
  linkWidth,
  payload,
}, buildingAnchorRef, sankeyMargin) {
  if (!Number.isFinite(linkWidth) || linkWidth <= 0.2) return null;
  const sourceNode = payload?.source;
  const targetNode = payload?.target;
  const sourceIsBuilding = sourceNode?.type === "building";
  const targetIsBuilding = targetNode?.type === "building";
  const flowSide = payload?.flowSide;
  const laneIndex = Number.isFinite(payload?.laneIndex) ? payload.laneIndex : 0;
  const laneCount = Number.isFinite(payload?.laneCount) ? Math.max(1, payload.laneCount) : 1;
  const rawSpanX = targetX - sourceX;
  const sideShift = Math.min(FLOW_SIDE_SEPARATION_X, Math.max(0, rawSpanX) * 0.3);
  const adjustedSourceX = sourceIsBuilding ? sourceX + sideShift : sourceX;
  const adjustedTargetX = targetIsBuilding ? targetX - sideShift : targetX;
  const sourceFrame = sourceIsBuilding
    ? resolvePinnedBuildingFrame(sourceNode, buildingAnchorRef, sankeyMargin)
    : null;
  const targetFrame = targetIsBuilding
    ? resolvePinnedBuildingFrame(targetNode, buildingAnchorRef, sankeyMargin)
    : null;
  const sourceSection = sourceFrame ? resolveBuildingSectionGeometryFromFrame(sourceFrame) : null;
  const targetSection = targetFrame ? resolveBuildingSectionGeometryFromFrame(targetFrame) : null;
  const recordFlowCenterY = (nodeName, centerY) => {
    if (!nodeName || !Number.isFinite(centerY)) return;
    if (!buildingAnchorRef?.current) return;
    const existingMap = buildingAnchorRef.current.flowCenterYByNodeName ?? {};
    existingMap[nodeName] = centerY;
    buildingAnchorRef.current.flowCenterYByNodeName = existingMap;
  };

  const chartHeight = Number.isFinite(buildingAnchorRef?.current?.chartHeight)
    ? buildingAnchorRef.current.chartHeight
    : ENERGY_FLOW_CHART_HEIGHT;
  const marginTop = Number.isFinite(sankeyMargin?.top) ? sankeyMargin.top : 0;
  const marginBottom = Number.isFinite(sankeyMargin?.bottom) ? sankeyMargin.bottom : 0;
  const safeTopBaseY = marginTop + FLOW_EDGE_GUARD;
  const safeBottomBaseY = chartHeight - marginBottom - FLOW_EDGE_GUARD;
  const clampY = (value, minY, maxY) =>
    maxY < minY ? (minY + maxY) / 2 : Math.max(minY, Math.min(maxY, value));
  const activeSection = sourceSection ?? targetSection;
  const sectionMinY = activeSection
    ? Math.max(
        safeTopBaseY,
        activeSection.topY + BUILDING_WALL_THICKNESS + FLOW_INTERIOR_PADDING,
      )
    : safeTopBaseY;
  const sectionMaxY = activeSection
    ? Math.min(
        safeBottomBaseY,
        activeSection.bottomY - BUILDING_WALL_THICKNESS - FLOW_INTERIOR_PADDING,
      )
    : safeBottomBaseY;
  const bandMinY = sectionMinY;
  const bandMaxY = sectionMaxY;
  const bandStartY = Math.min(bandMinY, bandMaxY);
  const bandEndY = Math.max(bandMinY, bandMaxY);
  const bandHeight = Math.max(12, bandEndY - bandStartY);
  const sideValues = Array.isArray(payload?.sideValues) && payload.sideValues.length === laneCount
    ? payload.sideValues.map((value) => (Number.isFinite(value) ? Math.max(0, value) : 0))
    : Array.from({ length: laneCount }, (_, index) => (index === laneIndex ? Math.max(0, payload?.value ?? 0) : 0));
  const valueScale = Number.isFinite(payload?.value) && payload.value > 0 ? linkWidth / payload.value : 0;
  const rawLaneWidths = sideValues.map((value, index) => {
    if (valueScale > 0 && value > 0) return value * valueScale;
    return index === laneIndex ? linkWidth : 0;
  });
  const desiredGap = Math.min(FLOW_LANE_GAP, Math.max(2, bandHeight * 0.05));
  const totalRawWidth = rawLaneWidths.reduce((sum, width) => sum + width, 0);
  const gapCount = Math.max(0, laneCount - 1);
  const maxGap = gapCount > 0 ? Math.max(0, (bandHeight - totalRawWidth) / gapCount) : 0;
  const laneGap = Math.min(desiredGap, maxGap);
  const usableHeight = Math.max(1, bandHeight - laneGap * gapCount);
  const packScale = totalRawWidth > 0 ? Math.min(1, usableHeight / totalRawWidth) : 1;
  const packedWidths = rawLaneWidths.map((width) => width * packScale);
  const packedWidth = Math.max(FLOW_MIN_HALF_WIDTH * 2, packedWidths[laneIndex] ?? linkWidth);
  const beforeWidth = packedWidths
    .slice(0, laneIndex)
    .reduce((sum, width) => sum + width, 0);
  const laneCenterY = bandStartY + beforeWidth + laneGap * laneIndex + packedWidth / 2;
  const halfWidth = packedWidth / 2;
  const safeTopY = safeTopBaseY + halfWidth;
  const safeBottomY = safeBottomBaseY - halfWidth;
  const laneMinY = Math.max(bandStartY + halfWidth, safeTopY);
  const laneMaxY = Math.min(bandEndY - halfWidth, safeBottomY);
  const laneY = clampY(laneCenterY, laneMinY, laneMaxY);
  const isInternalFloorFlow = sourceNode?.type === "internal-input" && targetIsBuilding && targetSection;
  if (isInternalFloorFlow) {
    const color = payload?.color ?? "#94a3b8";
    const anchoredSection = buildingAnchorRef?.current?.buildingSection;
    const sourceXFloor = Number.isFinite(anchoredSection?.centerX)
      ? anchoredSection.centerX
      : Number.isFinite(targetX)
        ? targetX + 6 // nodeWidth/2 (nodeWidth is fixed at 12)
        : targetSection.centerX;
    const sectionBottomY = Number.isFinite(anchoredSection?.bottomY)
      ? anchoredSection.bottomY
      : targetSection.bottomY;
    const sectionTopY = Number.isFinite(anchoredSection?.topY)
      ? anchoredSection.topY
      : targetSection.topY;
    const sectionHeight = Number.isFinite(anchoredSection?.sectionHeight)
      ? anchoredSection.sectionHeight
      : targetSection.sectionHeight;
    const interiorBottomY = sectionBottomY - BUILDING_WALL_THICKNESS - FLOW_INTERIOR_PADDING - halfWidth;
    const interiorTopY = sectionTopY + BUILDING_WALL_THICKNESS + FLOW_INTERIOR_PADDING + halfWidth;
    const sourceYFloor = clampY(interiorBottomY, safeTopY, safeBottomY);
    const desiredSpan = Math.max(18, Math.min(44, sectionHeight * 0.28));
    const targetYFloor = clampY(sourceYFloor - desiredSpan, interiorTopY, sourceYFloor - 6);
    const verticalSpan = Math.max(10, sourceYFloor - targetYFloor);
    const verticalArrowLength = Math.max(7, Math.min(15, verticalSpan * 0.35));
    const cutoutLength = Math.max(5, Math.min(9, verticalSpan * 0.24));
    const bodyEndY = targetYFloor + verticalArrowLength;
    const ribbonPath = [
      `M${sourceXFloor - halfWidth},${sourceYFloor}`,
      `L${sourceXFloor - halfWidth},${bodyEndY}`,
      `L${sourceXFloor + halfWidth},${bodyEndY}`,
      `L${sourceXFloor + halfWidth},${sourceYFloor}`,
      "Z",
    ].join(" ");
    const startCutoutPath = `M${sourceXFloor - halfWidth},${sourceYFloor} L${sourceXFloor + halfWidth},${sourceYFloor} L${sourceXFloor},${sourceYFloor - cutoutLength} Z`;
    const endArrowPath = `M${sourceXFloor},${targetYFloor} L${sourceXFloor - halfWidth},${bodyEndY} L${sourceXFloor + halfWidth},${bodyEndY} Z`;
    recordFlowCenterY(sourceNode?.name, sourceYFloor);
    return (
      <g>
        <path d={ribbonPath} fill={color} fillOpacity={0.62} stroke="none" />
        <path d={startCutoutPath} fill="#ffffff" fillOpacity={1} stroke="none" />
        <path d={endArrowPath} fill={color} fillOpacity={0.62} stroke="none" />
      </g>
    );
  }
  const adjustedSourceY = laneY;
  const adjustedTargetY = laneY;
  if (payload?.flowSide === "incoming") {
    recordFlowCenterY(sourceNode?.name, adjustedSourceY);
  }
  if (payload?.flowSide === "outgoing") {
    recordFlowCenterY(targetNode?.name, adjustedTargetY);
  }

  const span = Math.max(10, Math.abs(adjustedTargetX - adjustedSourceX));
  const arrowLength = Math.max(7, Math.min(15, span * 0.2));
  const cutoutLength = Math.max(6, Math.min(12, span * 0.16));
  const bodyEndX = adjustedTargetX - arrowLength;
  const y0Top = adjustedSourceY - halfWidth;
  const y0Bottom = adjustedSourceY + halfWidth;
  const y1Top = adjustedTargetY - halfWidth;
  const y1Bottom = adjustedTargetY + halfWidth;
  const sourceControlXAdjusted = sourceIsBuilding ? sourceControlX + sideShift * 0.6 : sourceControlX;
  const targetControlXAdjusted = targetIsBuilding ? targetControlX - sideShift * 0.6 : targetControlX;
  const clampedSourceControlX = Math.max(adjustedSourceX, sourceControlXAdjusted);
  const clampedTargetControlX = Math.min(bodyEndX, targetControlXAdjusted);
  const ribbonPath = [
    `M${adjustedSourceX},${y0Top}`,
    `C${clampedSourceControlX},${y0Top} ${clampedTargetControlX},${y1Top} ${bodyEndX},${y1Top}`,
    `L${bodyEndX},${y1Bottom}`,
    `C${clampedTargetControlX},${y1Bottom} ${clampedSourceControlX},${y0Bottom} ${adjustedSourceX},${y0Bottom}`,
    "Z",
  ].join(" ");
  const startCutoutPath = `M${adjustedSourceX},${y0Top} L${adjustedSourceX},${y0Bottom} L${adjustedSourceX + cutoutLength},${adjustedSourceY} Z`;
  const endArrowPath = `M${adjustedTargetX},${adjustedTargetY} L${bodyEndX},${y1Top} L${bodyEndX},${y1Bottom} Z`;
  const color = payload?.color ?? "#94a3b8";
  const isHvacFlow = payload?.flowType === "heating" || payload?.flowType === "cooling";
  const ribbonOpacity = isHvacFlow ? 0.82 : 0.62;

  return (
    <g>
      <path d={ribbonPath} fill={color} fillOpacity={ribbonOpacity} stroke="none" />
      <path d={startCutoutPath} fill="#ffffff" fillOpacity={1} stroke="none" />
      <path d={endArrowPath} fill={color} fillOpacity={ribbonOpacity} stroke="none" />
    </g>
  );
}

function renderEnergySankeyTooltip({ active, payload }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;
  const source = item?.source?.name ?? "Source";
  const target = item?.target?.name ?? "Target";
  const value = Number.isFinite(item?.value) ? Math.round(item.value) : 0;

  return (
    <div className="rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm">
      <p className="text-xs font-medium text-slate-700">
        {source}
        {" -> "}
        {target}
      </p>
      <p className="text-xs text-slate-500">{value} W</p>
    </div>
  );
}

export function EnergyFlowCard({
  snapshot,
  internalGain = 0,
  heatingW = 0,
  coolingW = 0,
  className,
  info,
}) {
  if (!snapshot) return null;
  const heatingDemandW = toPositiveW(heatingW);
  const coolingDemandW = toPositiveW(coolingW);
  const flow = buildEnergyFlowData({
    snapshot,
    internalGain,
    heatingW,
    coolingW,
  });

  const hasFlows = flow.sankeyData.links.length > 0;
  const storageRoundedW = Math.round(flow.storageW);
  const storageNote = flow.storageW > 1
    ? `Net +${storageRoundedW} W is warming the room fabric/air.`
    : flow.storageW < -1
      ? `Net ${storageRoundedW} W means stored heat is being released.`
      : "Incoming and outgoing heat are close to balanced.";
  const buildingAnchorRef = useRef(null);
  const handleSankeyResize = useCallback((width, height) => {
    if (!Number.isFinite(height)) return;
    buildingAnchorRef.current = {
      chartWidth: Number.isFinite(width) ? width : buildingAnchorRef.current?.chartWidth,
      chartHeight: height,
    };
  }, []);
  const nodeRenderer = useCallback(
    (props) => renderEnergySankeyNode(props, buildingAnchorRef, ENERGY_FLOW_SANKEY_MARGIN),
    [],
  );
  const linkRenderer = useCallback(
    (props) => renderEnergySankeyLink(props, buildingAnchorRef, ENERGY_FLOW_SANKEY_MARGIN),
    [],
  );

  return (
    <Card className={cn("space-y-3 p-5", info && "relative z-0 info-popover-host", className)}>
      {info && <InfoPopover>{info}</InfoPopover>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Energy flow (selected hour)
        </p>
        <p className="text-[11px] text-slate-500">
          In {Math.round(flow.totalInW)} W · Out {Math.round(flow.totalOutW)} W
        </p>
      </div>
      <p className="text-xs text-slate-600">
        Simplified Sankey: supply feeds the building, then heat leaves via losses or cooling.
      </p>
      <p className="text-xs text-slate-600">
        Heating/Cooling W is the estimated HVAC power needed right now to hold the comfort limit
        ({heatingDemandW > HVAC_FLOW_VISIBILITY_W ? ` heating ${Math.round(heatingDemandW)} W` : ""}{coolingDemandW > HVAC_FLOW_VISIBILITY_W ? `${heatingDemandW > HVAC_FLOW_VISIBILITY_W ? "," : ""} cooling ${Math.round(coolingDemandW)} W` : ""}{heatingDemandW <= HVAC_FLOW_VISIBILITY_W && coolingDemandW <= HVAC_FLOW_VISIBILITY_W ? " none active" : ""}).
      </p>
      <div className="relative rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="pointer-events-none absolute inset-x-3 top-2 hidden items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-slate-500 md:flex">
          <span>Supply</span>
          <span>Building</span>
          <span>Use / Losses</span>
        </div>
        {hasFlows ? (
          <div className="h-80 min-w-0 pt-0 md:pt-4">
            <ResponsiveContainer width="100%" height="100%" onResize={handleSankeyResize}>
              <Sankey
                data={flow.sankeyData}
                sort={false}
                node={nodeRenderer}
                link={linkRenderer}
                linkCurvature={0.48}
                nodeWidth={12}
                nodePadding={24}
                iterations={48}
                margin={ENERGY_FLOW_SANKEY_MARGIN}
              >
                <RechartsTooltip
                  cursor={false}
                  wrapperStyle={{ zIndex: 50 }}
                  content={renderEnergySankeyTooltip}
                />
              </Sankey>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center rounded-lg bg-white text-xs text-slate-500">
            No measurable energy flow at the selected hour.
          </div>
        )}
      </div>
      <p className="text-xs text-slate-500">{storageNote}</p>
      <p className="text-xs text-slate-500">
        Fabric loss split: Walls {Math.round(flow.fabricBreakdown.walls)} W · Windows {Math.round(flow.fabricBreakdown.windows)} W · Rooflight {Math.round(flow.fabricBreakdown.rooflight)} W · Roof {Math.round(flow.fabricBreakdown.roof)} W · Floor {Math.round(flow.fabricBreakdown.floor)} W
      </p>
      {flow.hasIngress && (
        <p className="text-xs text-slate-500">
          Outdoor conditions are currently adding heat through the envelope or ventilation.
        </p>
      )}
    </Card>
  );
}

export function VentilationCard({
  achTotal,
  ventilationLabel,
  compact = false,
  tight = false,
  className,
  info,
}) {
  const isTight = compact && tight;
  const containerClass = isTight
    ? "space-y-1 p-2"
    : compact
      ? "space-y-1.5 p-3"
      : "space-y-3 p-5";
  const valueClass = isTight ? "text-lg" : compact ? "text-xl" : "text-3xl";
  const unitClass = isTight ? "text-xs" : compact ? "text-sm" : "text-lg";
  const labelClass = isTight ? "text-[10px]" : "text-xs";

  return (
    <Card className={cn(containerClass, info && "relative z-0 info-popover-host", className)}>
      {info && <InfoPopover>{info}</InfoPopover>}
      <p className={`${labelClass} font-semibold uppercase tracking-wide text-slate-500`}>
        Fresh air rate
      </p>
      <p className={`${valueClass} font-semibold text-violet-600`}>
        {achTotal.toFixed(2)} <span className={`${unitClass} font-normal text-slate-500`}>ACH</span>
      </p>
      <p className={`${labelClass} text-slate-500`}>
        {ventilationLabel} · air changes per hour
      </p>
    </Card>
  );
}

export function IlluminanceCard({ illuminance, compact = false, className, info }) {
  const containerClass = compact ? "space-y-1.5 p-3" : "space-y-3 p-5";
  const valueClass = compact ? "text-xl" : "text-3xl";
  const unitClass = compact ? "text-sm" : "text-lg";

  const level = illuminance >= 500 ? "good" : illuminance >= 300 ? "adequate" : "low";
  const levelColor = level === "good" ? "text-green-600" : level === "adequate" ? "text-yellow-600" : "text-red-600";
  const levelLabel = level === "good" ? "Good for tasks" : level === "adequate" ? "Adequate" : "Low light";

  return (
    <Card className={cn(containerClass, info && "relative z-0 info-popover-host", className)}>
      {info && <InfoPopover>{info}</InfoPopover>}
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Desk light
      </p>
      <p className={`${valueClass} font-semibold text-pink-500`}>
        {Math.round(illuminance)} <span className={`${unitClass} font-normal text-slate-500`}>lux</span>
      </p>
      <p className={`text-xs ${levelColor}`}>
        {levelLabel}
      </p>
    </Card>
  );
}

export function ComfortGuidanceCard({ currentPoint, summary, comfortBand, stepMinutes }) {
  if (!currentPoint || !summary) return null;

  const isHeating = currentPoint.status === "heating";
  const isCooling = currentPoint.status === "cooling";
  const title = isHeating
    ? "Heating needed"
    : isCooling
      ? "Cooling needed"
      : "Within comfort range";
  const titleColor = isHeating
    ? "text-amber-700"
    : isCooling
      ? "text-sky-700"
      : "text-emerald-700";

  const actionText = isHeating
    ? `Heating needed: ~${Math.round(currentPoint.heatingW)} W over the next ${stepMinutes} min.`
    : isCooling
      ? `Cooling needed: ~${Math.round(currentPoint.coolingW)} W over the next ${stepMinutes} min.`
      : "No immediate heating or cooling required.";

  const ventilationText = isCooling
    ? currentPoint.ventilationHelpful
      ? "Outdoor air is cooler: ventilation helps."
      : "Outdoor air is warmer: ventilation won’t cool."
    : "Ventilation is optional for temperature right now.";

  return (
    <Card className="space-y-3 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Comfort guidance (1R1C)
      </p>
      <p className={`text-lg font-semibold ${titleColor}`}>{title}</p>
      <p className="text-sm text-slate-600">
        Indoor {currentPoint.T_in.toFixed(1)}°C versus comfort band {comfortBand.min} to {comfortBand.max}°C.
      </p>
      <p className="text-sm text-slate-600">{actionText}</p>
      <p className="text-sm text-slate-600">{ventilationText}</p>
      <p className="text-xs italic text-slate-500">
        Note: The model assumes 180 W of constant internal heat gains (occupants, equipment, lighting). This is why indoor temperature stays above outdoor even with no windows or solar gain.
      </p>
      <p className="text-xs text-slate-500">
        Fresh air rate {currentPoint.achTotal.toFixed(2)} air changes per hour (includes {ACH_INFILTRATION_DEFAULT.toFixed(2)} background).
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 md:grid-cols-4">
        <div className="rounded-md bg-slate-50 p-2">
          <p className="font-medium text-slate-700">Comfortable</p>
          <p>{summary.comfortableHours.toFixed(1)} h/day</p>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <p className="font-medium text-slate-700">Heating period</p>
          <p>{summary.heatingHours.toFixed(1)} h/day</p>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <p className="font-medium text-slate-700">Cooling period</p>
          <p>{summary.coolingHours.toFixed(1)} h/day</p>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <p className="font-medium text-slate-700">Thermal HVAC energy</p>
          <p>
            {summary.heatingEnergyKWh.toFixed(1)} / {summary.coolingEnergyKWh.toFixed(1)} kWh
          </p>
        </div>
      </div>
    </Card>
  );
}

export function EnvelopeAssumptionsCard({ uValues, presetLabel, presetDetail }) {
  const items = [
    { key: "wall", label: "Exterior walls" },
    { key: "roof", label: "Roof / ceiling" },
    { key: "floor", label: "Floor / slab" },
    { key: "window", label: "Window glazing" },
  ];

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Envelope assumptions
        </p>
        {presetLabel && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            {presetLabel}
          </span>
        )}
      </div>
      <div className="space-y-1 text-sm text-slate-600">
        {items.map(({ key, label }) => (
          <div className="flex items-center justify-between" key={key}>
            <span>{label}</span>
            <span className="font-mono text-xs text-slate-700">
              U = {(uValues?.[key] ?? 0).toFixed(2)} W/m²K
            </span>
          </div>
        ))}
      </div>
      {presetDetail && <p className="text-xs text-slate-500">{presetDetail}</p>}
      <p className="text-xs text-slate-500">
        These constants set the conductive heat-loss term used in the room balance.
      </p>
    </Card>
  );
}

export function CostCarbonCard({ title, periodLabel, summary, isAnnual = false }) {
  if (!summary) return null;
  const gridElectricityKWh = Number.isFinite(summary.gridElectricityKWh)
    ? Math.max(0, summary.gridElectricityKWh)
    : Math.max(0, summary.coolingFuelKWh ?? 0);
  const onSiteSolarKWh = Number.isFinite(summary.onSiteSolarKWh)
    ? Math.max(0, summary.onSiteSolarKWh)
    : 0;
  const solarUsedOnSiteKWh = Number.isFinite(summary.solarUsedOnSiteKWh)
    ? Math.max(0, summary.solarUsedOnSiteKWh)
    : Math.min(gridElectricityKWh, onSiteSolarKWh);
  const solarExportedKWh = Number.isFinite(summary.solarExportedKWh)
    ? Math.max(0, summary.solarExportedKWh)
    : Math.max(0, onSiteSolarKWh - solarUsedOnSiteKWh);
  const hasSolar = onSiteSolarKWh > 0.01;
  const hasExport = solarExportedKWh > 0.01;
  const coolingFuelKWh = Math.max(0, summary.coolingFuelKWh ?? 0);
  const offsetPct = coolingFuelKWh > 1e-6 ? (solarUsedOnSiteKWh / coolingFuelKWh) * 100 : 0;

  // Carbon accounting
  const grossCarbonKg = summary.grossCarbonKg ?? summary.carbonKg ?? 0;
  const displacedCarbonKg = summary.displacedCarbonKg ?? 0;
  const netCarbonKg = summary.carbonKg ?? grossCarbonKg;
  const carbonIntensity = summary.carbonIntensityKgM2Year ?? 0;
  const floorAreaM2 = summary.floorAreaM2 ?? 1;

  // LETI target comparison (for annual figures)
  const letiTarget = LETI_TARGETS[DEFAULT_LETI_TARGET];
  const meetsLetiTarget = isAnnual && carbonIntensity <= letiTarget.target;
  const isNetZero = isAnnual && netCarbonKg <= 0.01;
  const isCarbonNegative = isAnnual && netCarbonKg < -0.01;

  // Cost accounting
  const exportRevenue = summary.exportRevenue ?? 0;
  const hasExportRevenue = exportRevenue > 0.01;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        {periodLabel && <span className="text-[10px] text-slate-500">{periodLabel}</span>}
      </div>

      {/* LETI carbon intensity - THE KEY METRIC (annual only) */}
      {isAnnual && (
        <div className={`rounded-lg p-4 ${meetsLetiTarget ? "bg-emerald-50 border-2 border-emerald-300" : "bg-amber-50 border-2 border-amber-300"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {meetsLetiTarget ? (
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              )}
              <span className={`text-sm font-semibold ${meetsLetiTarget ? "text-emerald-800" : "text-amber-800"}`}>
                Carbon Intensity
              </span>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-bold ${meetsLetiTarget ? "text-emerald-700" : "text-amber-700"}`}>
                {carbonIntensity.toFixed(1)}
              </span>
              <span className={`text-xs ml-1 ${meetsLetiTarget ? "text-emerald-600" : "text-amber-600"}`}>
                kgCO₂e/m²/yr
              </span>
            </div>
          </div>
          <p className={`text-xs mt-2 ${meetsLetiTarget ? "text-emerald-700" : "text-amber-700"}`}>
            {meetsLetiTarget
              ? `✓ Meets LETI ${letiTarget.label} target (≤${letiTarget.target})`
              : `Target: ≤${letiTarget.target} · Currently ${(carbonIntensity - letiTarget.target).toFixed(1)} over`}
          </p>
          {isCarbonNegative && (
            <p className="text-xs mt-1 text-emerald-700 font-medium">
              Carbon negative — PV export offsets more than building operations emit
            </p>
          )}
        </div>
      )}

      {/* Energy demand section */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Energy Demand</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md bg-slate-50 p-2 text-center">
            <p className="text-slate-500 text-[10px]">Heating (gas)</p>
            <p className="font-semibold text-slate-700">{summary.heatingFuelKWh.toFixed(0)} kWh</p>
          </div>
          <div className="rounded-md bg-slate-50 p-2 text-center">
            <p className="text-slate-500 text-[10px]">Cooling</p>
            <p className="font-semibold text-slate-700">{summary.coolingFuelKWh.toFixed(0)} kWh</p>
          </div>
          <div className="rounded-md bg-slate-50 p-2 text-center">
            <p className="text-slate-500 text-[10px]">Lights + plugs</p>
            <p className="font-semibold text-slate-700">{(summary.baseElectricalKWh ?? 0).toFixed(0)} kWh</p>
          </div>
        </div>
      </div>

      {/* PV balance section */}
      {hasSolar && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Solar PV Balance</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-yellow-50 p-2 text-center">
              <p className="text-yellow-700 text-[10px]">PV generated</p>
              <p className="font-semibold text-yellow-800">{onSiteSolarKWh.toFixed(0)} kWh</p>
            </div>
            <div className="rounded-md bg-slate-50 p-2 text-center">
              <p className="text-slate-500 text-[10px]">Used on-site</p>
              <p className="font-semibold text-slate-700">{solarUsedOnSiteKWh.toFixed(0)} kWh</p>
            </div>
            <div className="rounded-md bg-slate-50 p-2 text-center">
              <p className="text-slate-500 text-[10px]">Grid import</p>
              <p className="font-semibold text-slate-700">{gridElectricityKWh.toFixed(0)} kWh</p>
            </div>
            {hasExport && (
              <div className="rounded-md bg-emerald-50 p-2 text-center">
                <p className="text-emerald-600 text-[10px]">Exported</p>
                <p className="font-semibold text-emerald-700">{solarExportedKWh.toFixed(0)} kWh</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cost summary */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Annual Cost</p>
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>Energy + standing charges</span>
          <span>{formatGBP((summary.energyCostGross ?? summary.energyCost) + summary.standingCost)}</span>
        </div>
        {hasExportRevenue && (
          <div className="flex items-center justify-between text-xs text-emerald-600">
            <span>Export revenue (SEG)</span>
            <span>−{formatGBP(exportRevenue)}</span>
          </div>
        )}
        <div className="flex items-center justify-between rounded-md bg-slate-100 px-3 py-2 text-slate-700">
          <span className="text-xs font-medium">Net cost</span>
          <span className="text-lg font-bold">{formatGBP(summary.totalCost)}</span>
        </div>
      </div>

      {/* Carbon summary */}
      <div className="space-y-1">
        {hasExport && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-slate-50 p-2 text-slate-600">
              <p className="font-medium text-slate-700">Gross emissions</p>
              <p>{formatKg(grossCarbonKg)}</p>
            </div>
            <div className="rounded-md bg-emerald-50 p-2 text-emerald-700">
              <p className="font-medium">Displaced by export</p>
              <p>−{formatKg(displacedCarbonKg)}</p>
            </div>
          </div>
        )}
        <div className={`flex items-center justify-between rounded-md px-3 py-2 ${isNetZero ? "bg-emerald-100 text-emerald-800 ring-2 ring-emerald-500" : "bg-slate-100 text-slate-700"}`}>
          <span className="text-xs flex items-center gap-1.5">
            {isNetZero && (
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            Net carbon
          </span>
          <span className={`text-lg font-bold ${isNetZero ? "text-emerald-700" : ""}`}>
            {isCarbonNegative ? `−${formatKg(Math.abs(netCarbonKg))}` : isNetZero ? "Net zero" : formatKg(netCarbonKg)}
          </span>
        </div>
      </div>

      {isNetZero && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2">
          <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-emerald-700 font-medium">
            {isCarbonNegative
              ? "Carbon negative! PV export displaces more grid carbon than building operations emit."
              : "Net zero operational carbon! Exported PV fully offsets heating, cooling, lighting and plug load emissions."}
          </p>
        </div>
      )}

      {!isNetZero && hasExport && isAnnual && (
        <p className="text-xs text-slate-500">
          To reach net zero: export needs to displace {formatKg(netCarbonKg)} more CO₂e.
          Consider electrifying heating (heat pump) to reduce gross emissions.
        </p>
      )}
    </Card>
  );
}

export function EnergyAssumptionsCard() {
  return (
    <Card className="space-y-3 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Cost + carbon assumptions
      </p>
      <div className="space-y-2 text-xs text-slate-600">
        <div className="flex items-center justify-between">
          <span>Heating system</span>
          <span className="font-mono text-[11px] text-slate-700">
            {HEATING_SYSTEM.label} (η {HEATING_SYSTEM.efficiency.toFixed(2)})
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Cooling system</span>
          <span className="font-mono text-[11px] text-slate-700">
            {COOLING_SYSTEM.label} (COP {COOLING_SYSTEM.cop.toFixed(1)})
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Electricity tariff</span>
          <span className="font-mono text-[11px] text-slate-700">
            {formatPence(ENERGY_TARIFFS.electricity.unitRate)}/kWh · {formatPence(ENERGY_TARIFFS.electricity.standingChargePerDay)}/day
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Gas tariff</span>
          <span className="font-mono text-[11px] text-slate-700">
            {formatPence(ENERGY_TARIFFS.gas.unitRate)}/kWh · {formatPence(ENERGY_TARIFFS.gas.standingChargePerDay)}/day
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Electricity carbon</span>
          <span className="font-mono text-[11px] text-slate-700">
            {CARBON_FACTORS.electricity.consumption.toFixed(3)} kg CO2e/kWh
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Gas carbon</span>
          <span className="font-mono text-[11px] text-slate-700">
            {CARBON_FACTORS.gas.perKWh.toFixed(3)} kg CO2e/kWh
          </span>
        </div>
        <p className="text-[10px] text-slate-500">
          Tariffs use the Ofgem price cap for {PRICE_CAP_PERIOD_LABEL}. Standing charges are included.
        </p>
      </div>
    </Card>
  );
}
