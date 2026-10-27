import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { cn } from "../../lib/cn";
import type { SlashItem } from "./extensions";

export interface SlashListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export const SlashList = forwardRef<SlashListRef, SuggestionProps<SlashItem>>(
  function SlashList(props, ref) {
    const [selected, setSelected] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      setSelected(0);
    }, [props.items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
        // items 为空时 (s+1) % 0 是 NaN —— 旧版方向键会把 selected 变成 NaN
        if (!props.items.length) return false;
        if (event.key === "ArrowDown") {
          setSelected((s) => (s + 1) % props.items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          setSelected((s) => (s - 1 + props.items.length) % props.items.length);
          return true;
        }
        if (event.key === "Enter") {
          const item = props.items[selected];
          if (item) {
            props.command(item);
            return true;
          }
        }
        return false;
      },
    }));

    useEffect(() => {
      const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`);
      node?.scrollIntoView({ block: "nearest" });
    }, [selected]);

    if (!props.items.length) {
      return (
        <div className="w-[260px] rounded-[4px] border border-line bg-paper px-3 py-3 text-xs text-ink-muted">
          没有匹配的插入项
        </div>
      );
    }

    return (
      <div
        ref={listRef}
        className="max-h-[340px] w-[272px] overflow-y-auto rounded-[4px] border border-line bg-paper p-1"
        style={{ boxShadow: "0 10px 32px rgba(35, 30, 24, 0.10)" }}
      >
        <div className="px-2 pb-1 pt-1.5 text-[11px] tracking-wide text-ink-faint">插入</div>
        {props.items.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              data-index={i}
              onMouseEnter={() => setSelected(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => props.command(item)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[3px] px-2 py-1.5 text-left",
                i === selected ? "bg-paper-alt" : "hover:bg-paper-alt/70",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border border-line",
                  i === selected ? "text-ink" : "text-ink-muted",
                )}
              >
                <Icon size={14} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink">{item.title}</span>
                {item.description ? (
                  <span className="block truncate text-[11px] text-ink-faint">
                    {item.description}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    );
  },
);
