import { useEffect, useState } from "react";
import type { PageSettings } from "../../lib/types";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-[12px] text-ink-muted">
      <span className="shrink-0">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          min={12}
          max={200}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!Number.isNaN(v)) onChange(v);
          }}
          className="h-8 w-16 rounded-[3px] border border-line bg-paper-alt px-2 text-right text-[12px] tabular-nums text-ink focus:border-line-hover focus:outline-none"
        />
        <span className="text-[11px] text-ink-faint">pt</span>
      </span>
    </label>
  );
}

const MARGIN_PRESETS = [
  { label: "标准", value: 72 },
  { label: "窄", value: 54 },
  { label: "宽", value: 96 },
];

export function PageSettingsDialog({
  open,
  onClose,
  page,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  page: PageSettings;
  onApply: (p: PageSettings) => void;
}) {
  const [draft, setDraft] = useState<PageSettings>(page);

  useEffect(() => {
    if (open) setDraft({ ...page, margin: { ...page.margin } });
  }, [open, page]);

  const apply = () => {
    onApply({
      ...draft,
      margin: {
        top: Math.min(240, Math.max(12, draft.margin.top)),
        right: Math.min(240, Math.max(12, draft.margin.right)),
        bottom: Math.min(240, Math.max(12, draft.margin.bottom)),
        left: Math.min(240, Math.max(12, draft.margin.left)),
      },
    });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="页面设置"
      width={380}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={apply}>
            应用
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[12px] text-ink-muted">
            <span className="mb-1.5 block text-[11px] text-ink-faint">纸张</span>
            <select
              value={draft.size}
              onChange={(e) =>
                setDraft((d) => ({ ...d, size: e.target.value as PageSettings["size"] }))
              }
              className="h-9 w-full rounded-[3px] border border-line bg-paper-alt px-2.5 text-[13px] text-ink focus:border-line-hover focus:outline-none"
            >
              <option value="A4">A4 · 210×297mm</option>
              <option value="Letter">Letter · 8.5×11in</option>
            </select>
          </label>
          <label className="block text-[12px] text-ink-muted">
            <span className="mb-1.5 block text-[11px] text-ink-faint">方向</span>
            <select
              value={draft.orientation}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  orientation: e.target.value as PageSettings["orientation"],
                }))
              }
              className="h-9 w-full rounded-[3px] border border-line bg-paper-alt px-2.5 text-[13px] text-ink focus:border-line-hover focus:outline-none"
            >
              <option value="portrait">纵向</option>
              <option value="landscape">横向</option>
            </select>
          </label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] text-ink-faint">页边距</span>
            <span className="flex items-center gap-1">
              {MARGIN_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="rounded-[3px] px-1.5 py-0.5 text-[11px] text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      margin: {
                        top: preset.value,
                        right: preset.value,
                        bottom: preset.value,
                        left: preset.value,
                      },
                    }))
                  }
                >
                  {preset.label}
                </button>
              ))}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-2 border-t border-line pt-3">
            <NumberField
              label="上"
              value={draft.margin.top}
              onChange={(v) => setDraft((d) => ({ ...d, margin: { ...d.margin, top: v } }))}
            />
            <NumberField
              label="下"
              value={draft.margin.bottom}
              onChange={(v) => setDraft((d) => ({ ...d, margin: { ...d.margin, bottom: v } }))}
            />
            <NumberField
              label="左"
              value={draft.margin.left}
              onChange={(v) => setDraft((d) => ({ ...d, margin: { ...d.margin, left: v } }))}
            />
            <NumberField
              label="右"
              value={draft.margin.right}
              onChange={(v) => setDraft((d) => ({ ...d, margin: { ...d.margin, right: v } }))}
            />
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-ink-faint">
          A4 纵向的正文宽度约 650px；边距过小会让打印内容贴近纸张边缘。
        </p>
      </div>
    </Dialog>
  );
}
