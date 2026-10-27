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
  useEditorTick(editor);

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
  }, [editor, editor?.state]);

  return (
    <aside className="no-print flex w-60 shrink-0 flex-col border-l border-line bg-paper-alt">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-line px-3">
        <span className="text-xs font-medium text-ink-muted">大纲</span>
        <button
          type="button"
          title="收起面板"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-muted hover:bg-black/5 dark:hover:bg-white/5"
          onClick={onClose}
        >
          <PanelRightClose size={14} strokeWidth={2} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {headings.length === 0 ? (
          <p className="px-2 py-3 text-xs leading-relaxed text-ink-faint">
            暂无标题。使用「标题 1 / 2 / 3」样式后，这里会显示文档大纲。
          </p>
        ) : (
          headings.map((h) => (
            <button
              key={h.pos}
              type="button"
              onClick={() => {
                editor?.chain().focus().setTextSelection(h.pos).scrollIntoView().run();
              }}
              className={cn(
                "block w-full truncate rounded-sm px-2 py-1 text-left text-xs text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5",
                h.level === 1 && "mt-1 font-medium text-ink",
                h.level === 2 && "pl-3.5",
                h.level === 3 && "pl-5",
                h.level >= 4 && "pl-[26px]",
              )}
            >
              {h.text}
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
