import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "danger" | "ai" | "primary";
  size?: "sm" | "md";
}

const VARIANTS = {
  default:
    "border border-line bg-transparent text-ink hover:border-line-hover hover:bg-paper-alt",
  primary: "border border-ink bg-ink text-paper hover:opacity-90",
  ghost:
    "border border-transparent bg-transparent text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5",
  danger:
    "border border-error/60 bg-transparent text-error hover:border-error hover:bg-error-light",
  ai: "border border-warning/70 bg-transparent text-warning hover:border-warning hover:bg-warning/10",
};

const SIZES = {
  sm: "h-8 px-2.5 text-xs rounded-[3px]",
  md: "h-9 px-3 text-[13px] rounded-[3px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size = "md", className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(
        "inline-flex select-none items-center justify-center gap-1.5 font-medium transition-colors",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  size?: "sm" | "md";
  label?: string;
  children?: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { active, size = "md", className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[3px] text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
        active && "bg-black/5 text-ink dark:bg-white/10 dark:text-[#E3DFD8]",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
