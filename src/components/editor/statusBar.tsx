import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { Minus, Plus } from "lucide-react";
import type { PageSettings } from "../../lib/types";

const ZOOM_LEVELS = [80, 90, 100, 110, 120, 140, 160, 180, 200];

export function StatusBar({
  editor,
  page,
  zoom,
  setZoom,
}: {
  editor: Editor | null;
  page?: PageSettings;
  zoom: number;
  setZoom: (z: number) => void;
}) {
  const stats = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e ? { characters: e.storage.characterCount.characters() as number } : { characters: 0 },
  }) ?? { characters: 0 };

  const pageLabel = page
    ? `${page.size} ${page.orientation === "landscape" ? "横向" : "纵向"}`
    : "";

  const step = (delta: number) => {
    const idx = ZOOM_LEVELS.findIndex((z) => z === zoom);
    const next =
      idx < 0
        ? 100
        : ZOOM_LEVELS[Math.min(Math.max(idx + delta, 0), ZOOM_LEVELS.length - 1)];
    setZoom(next);
  };

  return (
    <footer className="no-print flex h-8 shrink-0 items-center justify-between border-t border-line bg-paper px-3 text-[11px] text-ink-muted">
      <div className="flex items-center gap-3 tabular-nums">
        <span>{stats.characters.toLocaleString("zh-CN")} 字</span>
        {pageLabel ? (
          <>
            <span className="text-ink-faint">·</span>
            <span>{pageLabel}</span>
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-0.5">
        <button
          type="button"
          title="缩小"
          aria-label="缩小"
          className="inline-flex h-6 w-6 items-center justify-center rounded-[3px] text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
          onClick={() => step(-1)}
        >
          <Minus size={12} strokeWidth={2} />
        </button>
        <select
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="缩放比例"
          className="h-6 rounded-[3px] border border-transparent bg-transparent px-1 text-[11px] tabular-nums text-ink-muted hover:border-line focus:border-line-hover focus:outline-none"
        >
          {ZOOM_LEVELS.map((z) => (
            <option key={z} value={z}>
              {z}%
            </option>
          ))}
        </select>
        <button
          type="button"
          title="放大"
          aria-label="放大"
          className="inline-flex h-6 w-6 items-center justify-center rounded-[3px] text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
          onClick={() => step(1)}
        >
          <Plus size={12} strokeWidth={2} />
        </button>
      </div>
    </footer>
  );
}
