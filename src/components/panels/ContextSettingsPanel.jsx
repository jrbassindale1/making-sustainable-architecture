import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { InfoPopover } from "@/components/ui/info-popover";

export function ContextSettingsPanel({
  weatherDescription,
  weatherMeta,
  orientationDeg,
  onOrientationChange,
}) {
  return (
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
            orientation rotates the whole building, so a "North" face points south at 180°.
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
          onValueChange={(v) => onOrientationChange(v[0])}
        />
      </div>
    </div>
  );
}
