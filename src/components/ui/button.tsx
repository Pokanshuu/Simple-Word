import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "danger" | "ai" | "primary";
  size?: "sm" | "md";
}

const VARIANTS = {
  default:
    "bg-paper-alt border border-line text-ink hover:border-line-hover hover:bg-[#F0EBE3] dark:hover:bg-paper-card",
  primary:
    "bg-paper-card/60 border border-line text-ink hover:border-line-hover hover:bg-paper-card/80",
  ghost: "border border-transparent bg-transparent text-ink-muted hover:text-ink hover:bg-transparent dark:hover:bg-transparent",
  danger: "border border-error text-error bg-transparent hover:border-error hover:bg-error-light dark:hover:bg-red-950/30",
  ai: "border border-warning text-warning bg-transparent hover:border-warning hover:bg-warning/10",
};

const SIZES = {
  sm: "h-8 px-2.5 text-xs rounded",
  md: "h-9 px-3 text-sm rounded",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size = "md", className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn("inline-flex items-center justify-center gap-1.5 font-medium select-none", VARIANTS[variant], SIZES[size], className)}
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
        "inline-flex shrink-0 items-center justify-center rounded text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/10 dark:hover:text-dark-ink disabled:opacity-40",
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
