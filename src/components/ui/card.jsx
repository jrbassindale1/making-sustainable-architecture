import React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border border-slate-200/70 bg-white shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)]",
      className
    )}
    {...props}
  />
));

Card.displayName = "Card";

export { Card };
