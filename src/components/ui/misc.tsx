import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function Separator({ className, vertical }: { className?: string; vertical?: boolean }) {
  return (
    <div
      role="separator"
      className={cn("bg-line", vertical ? "mx-1.5 h-5 w-px shrink-0" : "my-1.5 h-px w-full", className)}
    />
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-line bg-paper-alt px-2 py-0.5 text-xs text-ink-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-paper-card px-1 font-sans text-[11px] text-ink-muted">
      {children}
    </kbd>
  );
}
