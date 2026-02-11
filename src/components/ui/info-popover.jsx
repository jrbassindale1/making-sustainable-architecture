import { cn } from "@/lib/utils";

export function InfoPopover({ children, className, panelClassName }) {
  return (
    <details
      className={cn("absolute right-3 top-3 z-[9999]", className)}
      data-info-popover
    >
      <summary className="flex h-5 w-5 cursor-pointer list-none items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
        i
      </summary>
      <div
        className={cn(
          "absolute right-0 z-[10000] mt-2 w-64 rounded-lg border border-slate-200 bg-white p-3 text-[11px] leading-snug text-slate-600 shadow-lg",
          panelClassName
        )}
      >
        {children}
      </div>
    </details>
  );
}
