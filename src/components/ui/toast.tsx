import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { cn } from "../../lib/cn";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

let toasts: ToastItem[] = [];
let nextId = 1;
const subs = new Set<() => void>();

function emit() {
  subs.forEach((cb) => cb());
}

export function toast(type: ToastType, message: string) {
  const id = nextId++;
  toasts = [...toasts, { id, type, message }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 3500);
}

function useToastStore(): ToastItem[] {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => toasts,
  );
}

const ICONS = {
  success: { Icon: CheckCircle, cls: "text-ink-muted" },
  error: { Icon: XCircle, cls: "text-error" },
  warning: { Icon: AlertTriangle, cls: "text-warning" },
  info: { Icon: Info, cls: "text-ink-muted" },
};

const ACCENT = {
  success: "border-l-line-hover",
  error: "border-l-error",
  warning: "border-l-warning",
  info: "border-l-line-hover",
};

export function ToastHost() {
  const items = useToastStore();
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[999] flex flex-col items-center gap-2">
      {items.map((item) => {
        const { Icon, cls } = ICONS[item.type];
        return (
          <div
            key={item.id}
            className={cn(
              "toast-item flex max-w-[420px] items-center gap-2.5 rounded-md border border-line border-l-2 bg-paper-card px-3.5 py-2.5 text-sm text-ink shadow-[0_1px_3px_rgba(0,0,0,0.06)]",
              ACCENT[item.type],
            )}
          >
            <Icon size={16} strokeWidth={2} className={cn("shrink-0", cls)} />
            <span className="min-w-0">{item.message}</span>
          </div>
        );
      })}
    </div>,
    document.getElementById("overlay-root") ?? document.body,
  );
}
