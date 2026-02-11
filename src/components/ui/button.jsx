import React from "react";
import { cn } from "@/lib/utils";

const variantClasses = {
  default:
    "bg-slate-900 text-white shadow-[0_10px_24px_-16px_rgba(15,23,42,0.7)] hover:bg-slate-800",
  secondary:
    "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50",
  outline: "border border-slate-300 text-slate-800 hover:bg-slate-50",
  ghost: "text-slate-700 hover:bg-slate-100",
};

const sizeClasses = {
  default: "h-10 px-4 py-2",
  sm: "h-8 px-3 text-sm",
  lg: "h-11 px-6 text-base",
};

const Button = React.forwardRef(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant] ?? variantClasses.default,
          sizeClasses[size] ?? sizeClasses.default,
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
