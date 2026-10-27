import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { CaseSensitive, ChevronDown, ChevronUp, X } from "lucide-react";
import {
  findMatches,
  nextMatchIndex,
  replaceAllMatches,
  replaceMatch,
  selectMatch,
} from "../../lib/findReplace";
import { cn } from "../../lib/cn";

/**
 * 查找替换浮条。
 *
 * 与旧版的行为差异（都是实际会踩到的坑）：
 * - 每次操作都按当前文档重算 matches，按位置替换 —— 不再用会过期的索引；
 * - 替换一处后自动选中下一处，按钮不会突然禁用；
 * - 全部替换是**一个事务**，一次 Ctrl+Z 就能撤销；
 * - 替换文本按纯文本插入，并保留被替换处的字符样式。
 */
export function FindReplaceBar({
  editor,
  onClose,
  onResult,
}: {
  editor: Editor;
  onClose: () => void;
  onResult?: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [index, setIndex] = useState(0);
  const [version, setVersion] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const { from, to, empty } = editor.state.selection;
    if (!empty) {
      const text = editor.state.doc.textBetween(from, to, "\n");
      if (text.length <= 200) setQuery(text);
    }
    findInputRef.current?.focus();
    findInputRef.current?.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    editor.on("update", bump);
    return () => {
      editor.off("update", bump);
    };
  }, [editor]);

  const matches = useMemo(
    () => findMatches(editor.state.doc, query, caseSensitive),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, query, caseSensitive, version],
  );

  const safeIndex = matches.length ? Math.min(index, matches.length - 1) : 0;
  const current = matches[safeIndex];

  const select = (next: number) => {
    const match = matches[next];
    if (!match) return;
    setIndex(next);
    selectMatch(editor, match);
  };

  const step = (delta: number) => {
    if (!matches.length) return;
    select((safeIndex + delta + matches.length) % matches.length);
  };

  const replaceOne = () => {
    if (!current) {
      onResult?.("没有可替换的匹配");
      return;
    }
    const from = current.from;
    replaceMatch(editor, current, replacement);
    const rest = findMatches(editor.state.doc, query, caseSensitive);
    if (!rest.length) {
      setIndex(0);
      onResult?.("已替换 1 处，没有更多匹配");
      return;
    }
    let next = rest.findIndex((m) => m.from >= from);
    if (next < 0) next = nextMatchIndex(rest, from);
    setIndex(next);
    selectMatch(editor, rest[next]);
  };

  const replaceAll = () => {
    const n = replaceAllMatches(editor, query, caseSensitive, replacement);
    setIndex(0);
    onResult?.(n ? `已替换 ${n} 处` : "没有可替换的匹配");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <div
      className="no-print fixed left-1/2 top-[68px] z-[110] w-[min(460px,calc(100vw-32px))] -translate-x-1/2 rounded-[4px] border border-line bg-paper p-2"
      style={{ boxShadow: "0 8px 28px rgba(35, 30, 24, 0.08)" }}
      onMouseDown={(e) => e.stopPropagation()}
      role="search"
    >
      <div className="flex items-center gap-1">
        <input
          ref={findInputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              step(e.shiftKey ? -1 : 1);
            }
          }}
          placeholder="查找"
          aria-label="查找"
          className="h-8 min-w-0 flex-1 rounded-[3px] border border-line bg-paper-alt px-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-line-hover focus:outline-none"
        />
        <span className="w-12 shrink-0 text-center text-[11px] tabular-nums text-ink-muted">
          {matches.length ? `${safeIndex + 1}/${matches.length}` : "0/0"}
        </span>
        <button
          type="button"
          title="上一个 (Shift+Enter)"
          aria-label="上一个"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
          onClick={() => step(-1)}
        >
          <ChevronUp size={15} strokeWidth={2} />
        </button>
        <button
          type="button"
          title="下一个 (Enter)"
          aria-label="下一个"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
          onClick={() => step(1)}
        >
          <ChevronDown size={15} strokeWidth={2} />
        </button>
        <button
          type="button"
          title="区分大小写"
          aria-label="区分大小写"
          aria-pressed={caseSensitive ? "true" : "false"}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-[3px]",
            caseSensitive
              ? "bg-black/5 text-ink dark:bg-white/10"
              : "text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5",
          )}
          onClick={() => {
            setCaseSensitive((v) => !v);
            setIndex(0);
          }}
        >
          <CaseSensitive size={15} strokeWidth={2} />
        </button>
        <button
          type="button"
          title="关闭 (Esc)"
          aria-label="关闭查找"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
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
              replaceOne();
            }
          }}
          placeholder="替换为"
          aria-label="替换为"
          className="h-8 min-w-0 flex-1 rounded-[3px] border border-line bg-paper-alt px-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-line-hover focus:outline-none"
        />
        <button
          type="button"
          disabled={!current}
          className="h-8 shrink-0 rounded-[3px] border border-line px-2.5 text-xs text-ink hover:border-line-hover hover:bg-paper-alt disabled:opacity-40"
          onClick={replaceOne}
        >
          替换
        </button>
        <button
          type="button"
          disabled={!matches.length}
          className="h-8 shrink-0 rounded-[3px] border border-line px-2.5 text-xs text-ink hover:border-line-hover hover:bg-paper-alt disabled:opacity-40"
          onClick={replaceAll}
        >
          全部替换
        </button>
      </div>
    </div>,
    document.getElementById("overlay-root") ?? document.body,
  );
}
