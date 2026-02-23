import React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

function clampValue(value, min, max) {
  let next = Number.isFinite(value) ? value : 0;
  if (Number.isFinite(min)) next = Math.max(min, next);
  if (Number.isFinite(max)) next = Math.min(max, next);
  return next;
}

const Slider = React.forwardRef(
  ({ className, min, max, value, onValueChange, ...props }, ref) => {
    const isControlled = Array.isArray(value);
    const safeControlledValue = React.useMemo(() => {
      if (!isControlled) return undefined;
      const fallback = Number.isFinite(min) ? min : 0;
      if (value.length === 0) return [fallback];
      return value.map((item) => clampValue(Number.isFinite(item) ? item : fallback, min, max));
    }, [isControlled, max, min, value]);

    const handleValueChange = React.useCallback(
      (nextValue) => {
        if (typeof onValueChange !== "function") return;
        if (!Array.isArray(nextValue) || nextValue.length === 0) return;
        const safeNextValue = nextValue
          .filter((item) => Number.isFinite(item))
          .map((item) => clampValue(item, min, max));
        if (safeNextValue.length === 0) return;
        onValueChange(safeNextValue);
      },
      [max, min, onValueChange],
    );

    return (
      <SliderPrimitive.Root
        ref={ref}
        className={cn("relative flex w-full touch-none select-none items-center", className)}
        min={min}
        max={max}
        onValueChange={handleValueChange}
        {...(isControlled ? { value: safeControlledValue } : {})}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-slate-200">
          <SliderPrimitive.Range className="absolute h-full bg-slate-900" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-slate-900 bg-white shadow transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:pointer-events-none disabled:opacity-50" />
      </SliderPrimitive.Root>
    );
  },
);

Slider.displayName = "Slider";

export { Slider };
