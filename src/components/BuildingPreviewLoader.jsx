export function BuildingPreviewLoader({ className = "", size = "default" }) {
  const isCompact = size === "compact";

  return (
    <div
      className={`flex items-center justify-center rounded-lg bg-slate-100 ${
        isCompact ? "min-h-[300px]" : "min-h-[400px]"
      } ${className}`}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600" />
        <p className="text-sm text-slate-500">Loading 3D view...</p>
      </div>
    </div>
  );
}
