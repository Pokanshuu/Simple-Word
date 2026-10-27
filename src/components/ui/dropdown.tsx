import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/cn";

interface DropdownCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  align: "start" | "end";
  position: { top: number; left: number };
  anchor: HTMLElement | null;
}

const Ctx = createContext<DropdownCtx | null>(null);

export function Dropdown({
  trigger,
  children,
  align = "start",
  className,
  onOpenChange,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [menuW, setMenuW] = useState(0);
  const anchorRef = useRef<HTMLDivElement>(null);

  const setOpenWrapped = useCallback(
    (v: boolean) => {
      setOpen(v);
      onOpenChange?.(v);
    },
    [onOpenChange],
  );

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const menuH = 320; // 估计值，溢出时再裁剪
    const left = align === "start" ? rect.left : rect.right - menuW;
    const clampedLeft = Math.max(8, Math.min(left, window.innerWidth - Math.max(menuW, 160) - 8));
    let top = rect.bottom + 4;
    if (top + menuH > window.innerHeight - 8) {
      top = Math.max(8, rect.top - menuH - 4);
    }
    setPosition({ top, left: clampedLeft });
  }, [open, align, menuW]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (!(e.target instanceof Node)) return;
      if (anchorRef.current?.contains(e.target)) return;
      const overlay = document.getElementById("overlay-root");
      if (overlay && overlay.contains(e.target)) return;
      setOpenWrapped(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenWrapped(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, setOpenWrapped]);

  return (
    <div ref={anchorRef} className={cn("relative inline-flex", className)}>
      <div onClick={() => setOpenWrapped(!open)}>{trigger}</div>
      <Ctx.Provider value={{ open, setOpen: setOpenWrapped, align, position, anchor: anchorRef.current }}>
        <DropdownContent onMeasure={setMenuW}>{children}</DropdownContent>
      </Ctx.Provider>
    </div>
  );
}

function DropdownContent({
  children,
  onMeasure,
}: {
  children: ReactNode;
  onMeasure: (w: number) => void;
}) {
  const ctx = useContext(Ctx);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (ctx?.open && ref.current) {
      onMeasure(ref.current.offsetWidth);
    }
  }, [ctx?.open, children, onMeasure]);

  if (!ctx?.open) return null;

  return createPortal(
    <div
      ref={ref}
      className="pointer-events-auto absolute z-[120] min-w-[160px] rounded-md border border-line bg-paper/60 p-1 shadow-none ring-1 ring-black/5 backdrop-blur-lg dark:bg-paper/70"
      style={{ top: ctx.position.top, left: ctx.position.left, position: "fixed" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.getElementById("overlay-root") ?? document.body,
  );
}

export function DropdownItem({
  children,
  onClick,
  icon,
  danger,
  active,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  icon?: ReactNode;
  danger?: boolean;
  active?: boolean;
  className?: string;
}) {
  const ctx = useContext(Ctx);
  return (
    <button
      type="button"
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        onClick?.();
        ctx?.setOpen(false);
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-ink hover:bg-black/5 dark:hover:bg-white/5",
        danger && "text-error hover:bg-error-light dark:hover:bg-red-950/30",
        active && "bg-paper-card",
        className,
      )}
    >
      {icon ? <span className="text-ink-muted">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 h-px w-full bg-line" />;
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <div className="px-2 py-1 text-xs text-ink-faint">{children}</div>;
}
