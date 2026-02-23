import { Card } from "@/components/ui/card";
import { InfoPopover } from "@/components/ui/info-popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
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
  const gasUseKWh = Number.isFinite(summary.gasUseKWh)
    ? summary.gasUseKWh
    : summary.heatingFuelKWh;
  const electricityUseKWh = Number.isFinite(summary.electricityUseKWh)
    ? summary.electricityUseKWh
    : summary.coolingFuelKWh;
  const gasEnergyCost = Number.isFinite(summary.gasEnergyCost)
    ? summary.gasEnergyCost
    : gasUseKWh * ENERGY_TARIFFS.gas.unitRate;
  const electricityEnergyCost = Number.isFinite(summary.electricityEnergyCost)
    ? summary.electricityEnergyCost
    : electricityUseKWh * ENERGY_TARIFFS.electricity.unitRate;
  const gasStandingCost = Number.isFinite(summary.gasStandingCost)
    ? summary.gasStandingCost
    : summary.standingCost * 0.5;
  const electricityStandingCost = Number.isFinite(summary.electricityStandingCost)
    ? summary.electricityStandingCost
    : summary.standingCost * 0.5;
  const gasCarbonKg = Number.isFinite(summary.gasCarbonKg)
    ? summary.gasCarbonKg
    : gasUseKWh * CARBON_FACTORS.gas.perKWh;
  const electricityCarbonKg = Number.isFinite(summary.electricityCarbonKg)
    ? summary.electricityCarbonKg
    : electricityUseKWh * CARBON_FACTORS.electricity.consumption;

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        {periodLabel && <span className="text-[10px] text-slate-500">{periodLabel}</span>}
      </div>
      <p className="text-xs text-slate-600">
        Thermal demand {summary.heatingThermalKWh.toFixed(1)} / {summary.coolingThermalKWh.toFixed(1)} kWh (heat/cool).
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div className="rounded-md bg-slate-50 p-2">
          <p className="font-medium text-slate-700">Gas use (heating)</p>
          <p>{gasUseKWh.toFixed(1)} kWh</p>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <p className="font-medium text-slate-700">Electricity use (cooling)</p>
          <p>{electricityUseKWh.toFixed(1)} kWh</p>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <p className="font-medium text-slate-700">Gas spend</p>
          <p>{formatGBP(gasEnergyCost)}</p>
          <p className="text-[10px] text-slate-500">+ standing {formatGBP(gasStandingCost)}</p>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <p className="font-medium text-slate-700">Electricity spend</p>
          <p>{formatGBP(electricityEnergyCost)}</p>
          <p className="text-[10px] text-slate-500">+ standing {formatGBP(electricityStandingCost)}</p>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-md bg-slate-100 px-3 py-2 text-slate-700">
        <span className="text-xs">Total spend (all-in)</span>
        <span className="text-right">
          <span className="block text-lg font-bold">{formatGBP(summary.totalCost)}</span>
          <span className="text-[10px] text-slate-500">includes {formatGBP(summary.standingCost)} standing charges</span>
        </span>
      </div>
      <div className="flex items-center justify-between rounded-md bg-slate-100 px-3 py-2 text-slate-700">
        <span className="text-xs">
          Carbon emissions
          {isAnnual ? " (per year)" : ""}
        </span>
        <span className="text-right">
          <span className="block text-lg font-bold">{formatKg(summary.carbonKg)}</span>
          <span className="text-[10px] text-slate-500">
            Gas {formatKg(gasCarbonKg)} · Elec {formatKg(electricityCarbonKg)}
          </span>
        </span>
      </div>
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
