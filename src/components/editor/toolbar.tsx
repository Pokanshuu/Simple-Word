import { useEffect, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

/** TipTap v3 不再自动触发重渲染，订阅 transaction 以刷新激活态 */
export function useEditorTick(editor: Editor | null): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const on = () => setTick((t) => t + 1);
    editor.on("transaction", on);
    return () => {
      editor.off("transaction", on);
    };
  }, [editor]);
  return tick;
}

export function ToolButton({
  icon: Icon,
  onClick,
  active,
  disabled,
  label,
  size = "sm",
}: {
  icon: LucideIcon;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onClick?.()}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded text-ink-muted transition-colors hover:bg-black/5 hover:text-ink dark:hover:bg-white/5 dark:hover:text-[#E3DFD8]",
        size === "sm" ? "h-7 w-7" : "h-8 w-8",
        active && "bg-black/5 text-ink dark:bg-white/10 dark:text-[#E3DFD8]",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <Icon size={size === "sm" ? 15 : 16} strokeWidth={2} />
    </button>
  );
}

export function ToolDivider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-line" />;
}

export function ToolGroup({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-center gap-0.5">{children}</div>;
}
