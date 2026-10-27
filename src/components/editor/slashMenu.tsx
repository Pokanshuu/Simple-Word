import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { cn } from "../../lib/cn";
import type { SlashItem } from "./extensions";

export interface SlashListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export const SlashList = forwardRef<SlashListRef, SuggestionProps<SlashItem>>(
  function SlashList(props, ref) {
    const [selected, setSelected] = useState(0);

    useEffect(() => {
      setSelected(0);
    }, [props.items]);

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: SuggestionKeyDownProps) => {
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
          return false;
        }
        return false;
      },
    }));

    if (!props.items.length) {
      return (
        <div className="min-w-[260px] rounded-md border border-line bg-paper/60 p-3 text-sm text-ink-muted shadow-none ring-1 ring-black/5 backdrop-blur-lg dark:bg-paper/70">
          没有匹配的插入项
        </div>
      );
    }

    return (
      <div className="max-h-[360px] w-[280px] overflow-y-auto rounded-md border border-line bg-paper/60 p-1 shadow-none ring-1 ring-black/5 backdrop-blur-lg dark:bg-paper/70">
        <div className="px-2 py-1 text-xs text-ink-faint">插入</div>
        {props.items.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              onMouseEnter={() => setSelected(i)}
              onClick={() => props.command(item)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left",
                i === selected && "bg-paper-card",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded border border-line bg-paper-card",
                  i === selected ? "text-ink" : "text-ink-muted",
                )}
              >
                <Icon size={15} strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{item.title}</span>
                {item.description ? (
                  <span className="block truncate text-xs text-ink-faint">{item.description}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    );
  },
);
