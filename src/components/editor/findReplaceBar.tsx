import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { CaseSensitive, ChevronDown, ChevronUp, X } from "lucide-react";
import { findMatches, nextMatchIndex, replaceAllMatches, replaceMatch, selectMatch } from "../../lib/findReplace";
import { useEditorTick } from "./toolbar";
import { cn } from "../../lib/cn";

export function FindReplaceBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const tick = useEditorTick(editor);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [index, setIndex] = useState(-1);
  const findInputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(
    () => findMatches(editor.state.doc, query, caseSensitive),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, query, caseSensitive, tick],
  );

  useEffect(() => {
    const { from, to, empty } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, "\n");
    if (!empty && text.length <= 200) setQuery(text);
    findInputRef.current?.focus();
    findInputRef.current?.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const goTo = (delta: 1 | -1) => {
    if (!matches.length) return;
    const fromPos = editor.state.selection.to;
    let next: number;
    if (delta === 1) {
      next = nextMatchIndex(matches, fromPos + (index >= 0 ? 1 : 0));
    } else {
      next = index - 1;
      if (next < 0) next = matches.length - 1;
    }
    setIndex(next);
    selectMatch(editor, matches[next]);
  };

  const doReplace = () => {
    if (index < 0 || index >= matches.length) return;
    replaceMatch(editor, matches[index], replacement);
    setIndex(-1);
  };

  const doReplaceAll = () => {
    if (!query) return;
    const n = replaceAllMatches(editor, query, caseSensitive, replacement);
    setIndex(-1);
    onClose();
    // toast 放在父级处理
    void n;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <div
      className="no-print fixed left-1/2 top-[76px] z-[110] w-[440px] -translate-x-1/2 rounded-md border border-line bg-paper/70 p-2 shadow-none ring-1 ring-black/5 backdrop-blur-lg dark:bg-paper/80"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1">
        <input
          ref={findInputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              goTo(e.shiftKey ? -1 : 1);
            }
          }}
          placeholder="查找"
          className="h-8 min-w-0 flex-1 rounded border border-line bg-paper-card px-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-line-hover focus:outline-none"
        />
        <span className="w-12 shrink-0 text-center text-xs tabular-nums text-ink-muted">
          {matches.length ? `${Math.min(index + 1, matches.length)}/${matches.length}` : "0/0"}
        </span>
        <button
          type="button"
          title="上一个 (Shift+Enter)"
          className="inline-flex h-8 w-8 items-center justify-center rounded text-ink-muted hover:bg-black/5 dark:hover:bg-white/5"
          onClick={() => goTo(-1)}
        >
          <ChevronUp size={15} strokeWidth={2} />
        </button>
        <button
          type="button"
          title="下一个 (Enter)"
          className="inline-flex h-8 w-8 items-center justify-center rounded text-ink-muted hover:bg-black/5 dark:hover:bg-white/5"
          onClick={() => goTo(1)}
        >
          <ChevronDown size={15} strokeWidth={2} />
        </button>
        <button
          type="button"
          title="区分大小写"
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded",
            caseSensitive ? "bg-black/5 text-ink dark:bg-white/10" : "text-ink-muted hover:bg-black/5 dark:hover:bg-white/5",
          )}
          onClick={() => setCaseSensitive((v) => !v)}
        >
          <CaseSensitive size={15} strokeWidth={2} />
        </button>
        <button
          type="button"
          title="关闭 (Esc)"
          className="inline-flex h-8 w-8 items-center justify-center rounded text-ink-muted hover:bg-black/5 dark:hover:bg-white/5"
          onClick={onClose}
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-1 border-t border-line pt-1.5">
        <input
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              doReplace();
            }
          }}
          placeholder="替换为"
          className="h-8 min-w-0 flex-1 rounded border border-line bg-paper-card px-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-line-hover focus:outline-none"
        />
        <button
          type="button"
          disabled={index < 0}
          className="h-8 shrink-0 rounded border border-line bg-paper-alt px-2.5 text-sm text-ink hover:border-line-hover hover:bg-paper-card disabled:opacity-40"
          onClick={doReplace}
        >
          替换
        </button>
        <button
          type="button"
          className="h-8 shrink-0 rounded border border-line bg-paper-alt px-2.5 text-sm text-ink hover:border-line-hover hover:bg-paper-card"
          onClick={doReplaceAll}
        >
          全部替换
        </button>
      </div>
    </div>,
    document.getElementById("overlay-root") ?? document.body,
  );
}
