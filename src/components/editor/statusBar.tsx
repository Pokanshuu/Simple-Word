import type { Editor } from "@tiptap/react";
import { Minus, Plus } from "lucide-react";
import { useEditorTick } from "./toolbar";

const ZOOM_LEVELS = [80, 90, 100, 110, 120, 140, 160, 180, 200];

export function StatusBar({
  editor,
  zoom,
  setZoom,
  savedText,
}: {
  editor: Editor | null;
  zoom: number;
  setZoom: (z: number) => void;
  savedText: string;
}) {
  const tick = useEditorTick(editor);
  void tick;

  const words = editor?.storage.characterCount.words() ?? 0;
  const chars = editor?.storage.characterCount.characters() ?? 0;

  const step = (delta: number) => {
    const idx = ZOOM_LEVELS.findIndex((z) => z === zoom);
    const next = idx < 0 ? 100 : ZOOM_LEVELS[Math.min(Math.max(idx + delta, 0), ZOOM_LEVELS.length - 1)];
    setZoom(next);
  };

  return (
    <footer className="no-print flex h-9 shrink-0 items-center justify-between border-t border-line bg-paper px-4 text-xs text-ink-muted">
      <div className="flex items-center gap-4">
        <span>
          字数 <span className="tabular-nums text-ink">{words}</span>
        </span>
        <span>
          字符 <span className="tabular-nums text-ink">{chars}</span>
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span>{savedText}</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="缩小"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-muted hover:bg-black/5 dark:hover:bg-white/5"
            onClick={() => step(-1)}
          >
            <Minus size={13} strokeWidth={2} />
          </button>
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-6 rounded border border-line bg-paper-card px-1 text-xs text-ink focus:border-line-hover focus:outline-none"
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
            className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-muted hover:bg-black/5 dark:hover:bg-white/5"
            onClick={() => step(1)}
          >
            <Plus size={13} strokeWidth={2} />
          </button>
        </div>
      </div>
    </footer>
  );
}
