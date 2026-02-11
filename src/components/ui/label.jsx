import React from "react";
import * as RadixLabel from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

const Label = React.forwardRef(({ className, ...props }, ref) => (
  <RadixLabel.Root
    ref={ref}
    className={cn("text-sm font-medium text-slate-700", className)}
    {...props}
  />
));

Label.displayName = "Label";

export { Label };

