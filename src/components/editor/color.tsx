import type { ReactNode } from "react";
import { Check, ChevronDown, Pipette } from "lucide-react";
import { cn } from "../../lib/cn";
import { DEFAULT_PALETTE } from "../../lib/palette";
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from "../ui/dropdown";

export function ColorTrigger({ color }: { color?: string }) {
  return (
    <button
      type="button"
      title="文字颜色"
      aria-label="文字颜色"
      onMouseDown={(e) => e.preventDefault()}
      className="inline-flex h-7 items-center gap-1 rounded-[3px] px-1.5 text-sm text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
    >
      <span className="font-serif text-[15px] leading-none">A</span>
      <span
        className="mt-2 h-[3px] w-4 rounded-full"
        style={{ backgroundColor: color ?? "var(--color-ink)" }}
      />
      <ChevronDown size={12} strokeWidth={2} className="text-ink-faint" />
    </button>
  );
}

export function ColorPanel({
  palette,
  current,
  onPick,
  extra,
}: {
  palette: string[];
  current?: string;
  onPick: (color: string) => void;
  extra?: ReactNode;
}) {
  const colors = palette.length ? palette : DEFAULT_PALETTE;
  return (
    <div className="w-[176px] p-2" onMouseDown={(e) => e.stopPropagation()}>
      <div className="grid grid-cols-8 gap-1">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            title={color}
            aria-label={color}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(color)}
            className={cn(
              "h-4 w-4 rounded-full border border-line transition-transform hover:scale-110",
              current?.toLowerCase() === color.toLowerCase() && "ring-1 ring-ink-faint ring-offset-1",
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
        <label
          title="自定义颜色"
          className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-[3px] text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
        >
          <Pipette size={13} strokeWidth={2} />
          <input
            type="color"
            className="h-0 w-0 opacity-0"
            value={current && /^#([0-9a-fA-F]{6})$/.test(current) ? current : "#2b2b2b"}
            onChange={(e) => onPick(e.target.value)}
          />
        </label>
        <span className="text-[10px] tabular-nums text-ink-faint">{current ?? "默认"}</span>
      </div>
      {extra}
    </div>
  );
}

/** 颜色选择（Dropdown 封装） */
export function ColorDropdown({
  palette,
  current,
  onPick,
  children,
}: {
  palette: string[];
  current?: string;
  onPick: (color: string) => void;
  children: ReactNode;
}) {
  return (
    <Dropdown trigger={children} align="start">
      <ColorPanel palette={palette} current={current} onPick={onPick} />
    </Dropdown>
  );
}

/* ---------- 标题级别选择 ---------- */

const HEADING_ITEMS: { level: 1 | 2 | 3 | 4 | 5 | 6 | null; label: string }[] = [
  { level: null, label: "正文" },
  { level: 1, label: "标题 1" },
  { level: 2, label: "标题 2" },
  { level: 3, label: "标题 3" },
  { level: 4, label: "标题 4" },
  { level: 5, label: "标题 5" },
  { level: 6, label: "标题 6" },
];

export function HeadingSelect({
  editor,
  className,
}: {
  editor: import("@tiptap/react").Editor;
  className?: string;
}) {
  const activeHeading = HEADING_ITEMS.find((h) =>
    h.level === null ? editor.isActive("paragraph") : editor.isActive("heading", { level: h.level }),
  );
  const label = activeHeading?.label ?? "正文";

  return (
    <Dropdown
      className={className}
      trigger={
        <button
          type="button"
          title="段落样式"
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            "inline-flex h-7 items-center gap-0.5 rounded-[3px] px-2 text-[13px] text-ink hover:bg-black/5 dark:hover:bg-white/5",
            className,
          )}
        >
          <span className={cn("w-[42px] truncate text-left", activeHeading?.level && "font-serif font-semibold")}>
            {label}
          </span>
          <ChevronDown size={12} strokeWidth={2} className="shrink-0 text-ink-faint" />
        </button>
      }
    >
      <DropdownLabel>段落样式</DropdownLabel>
      <DropdownSeparator />
      {HEADING_ITEMS.map((h) => {
        const active = activeHeading?.level === h.level && (h.level !== null || editor.isActive("paragraph"));
        return (
          <DropdownItem
            key={h.level ?? "p"}
            active={active}
            suffix={active ? <Check size={13} strokeWidth={2} /> : null}
            onClick={() => {
              if (h.level === null) editor.chain().focus().setParagraph().run();
              else editor.chain().focus().setHeading({ level: h.level }).run();
            }}
          >
            <span className={h.level ? "font-serif font-semibold" : ""}>{h.label}</span>
          </DropdownItem>
        );
      })}
    </Dropdown>
  );
}
