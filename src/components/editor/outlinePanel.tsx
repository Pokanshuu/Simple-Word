import { useMemo } from "react";
import type { Editor } from "@tiptap/react";
import { PanelRightClose } from "lucide-react";
import { useEditorTick } from "./toolbar";
import { cn } from "../../lib/cn";

interface HeadingEntry {
  level: number;
  text: string;
  pos: number;
}

export function OutlinePanel({
  editor,
  onClose,
}: {
  editor: Editor | null;
  onClose: () => void;
}) {
  const tick = useEditorTick(editor);

  const headings = useMemo<HeadingEntry[]>(() => {
    if (!editor) return [];
    const out: HeadingEntry[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "heading") {
        out.push({
          level: Number(node.attrs.level ?? 1),
          text: node.textContent.slice(0, 80) || "（空标题）",
          pos,
        });
      }
      return true;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, tick]);

  const activeIndex = useMemo(() => {
    if (!editor || !headings.length) return -1;
    const from = editor.state.selection.from;
    let current = -1;
    headings.forEach((heading, index) => {
      if (heading.pos <= from) current = index;
    });
    return current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, headings, tick]);

  return (
    <aside className="no-print flex w-[228px] shrink-0 flex-col border-l border-line bg-paper-alt">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-3">
        <span className="text-[11px] tracking-wide text-ink-muted">
          大纲
          {headings.length ? (
            <span className="ml-1.5 tabular-nums text-ink-faint">{headings.length}</span>
          ) : null}
        </span>
        <button
          type="button"
          title="收起面板"
          aria-label="收起大纲"
          className="inline-flex h-6 w-6 items-center justify-center rounded-[3px] text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
          onClick={onClose}
        >
          <PanelRightClose size={14} strokeWidth={2} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {headings.length === 0 ? (
          <p className="px-2 py-3 text-[11px] leading-relaxed text-ink-faint">
            暂无标题。使用「标题 1 / 2 / 3」样式后，这里会显示文档大纲。
          </p>
        ) : (
          headings.map((heading, index) => (
            <button
              key={`${heading.pos}-${heading.text}`}
              type="button"
              onClick={() => {
                editor
                  ?.chain()
                  .focus()
                  .setTextSelection(heading.pos + 1)
                  .scrollIntoView()
                  .run();
              }}
              className={cn(
                "block w-full truncate rounded-[3px] px-2 py-1 text-left text-[12px] leading-5 text-ink-muted hover:bg-black/[0.04] hover:text-ink dark:hover:bg-white/5",
                index === activeIndex && "bg-black/[0.04] text-ink dark:bg-white/5",
                heading.level === 1 && "font-medium text-ink",
                heading.level === 2 && "pl-3.5",
                heading.level === 3 && "pl-5",
                heading.level >= 4 && "pl-[26px]",
              )}
              title={heading.text}
            >
              {heading.text}
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
