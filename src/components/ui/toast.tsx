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
  toasts = [...toasts.slice(-3), { id, type, message }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 3600);
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
  info: { Icon: Info, cls: "text-ink-faint" },
};

const ACCENT = {
  success: "border-l-line-hover",
  error: "border-l-error",
  warning: "border-l-warning",
  info: "border-l-line",
};

export function ToastHost() {
  const items = useToastStore();
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[999] flex flex-col items-center gap-2">
      {items.map((item) => {
        const { Icon, cls } = ICONS[item.type];
        return (
          <div
            key={item.id}
            className={cn(
              "toast-item flex max-w-[440px] items-center gap-2.5 rounded-[4px] border border-line border-l-2 bg-paper px-3.5 py-2.5 text-[13px] text-ink",
              ACCENT[item.type],
            )}
            style={{ boxShadow: "0 8px 26px rgba(35, 30, 24, 0.10)" }}
            role="status"
          >
            <Icon size={15} strokeWidth={2} className={cn("shrink-0", cls)} />
            <span className="min-w-0 leading-relaxed">{item.message}</span>
          </div>
        );
      })}
    </div>,
    document.getElementById("overlay-root") ?? document.body,
  );
}
