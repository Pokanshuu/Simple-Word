import { useEffect, useState } from "react";
import type { PageSettings } from "../../lib/types";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-ink-muted">
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
          className="h-8 w-20 rounded border border-line bg-paper-card px-2 text-right text-sm text-ink focus:border-line-hover focus:outline-none"
        />
        <span className="text-xs text-ink-faint">pt</span>
      </span>
    </label>
  );
}

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
    if (open) setDraft(page);
  }, [open, page]);

  const apply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="页面设置"
      width={360}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button onClick={apply}>应用</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm text-ink-muted">
            <span className="mb-1 block text-xs">纸张大小</span>
            <select
              value={draft.size}
              onChange={(e) => setDraft((d) => ({ ...d, size: e.target.value as PageSettings["size"] }))}
              className="h-9 w-full rounded border border-line bg-paper-card px-2.5 text-sm text-ink focus:border-line-hover focus:outline-none"
            >
              <option value="A4">A4 (210×297mm)</option>
              <option value="Letter">Letter (8.5×11in)</option>
            </select>
          </label>
          <label className="text-sm text-ink-muted">
            <span className="mb-1 block text-xs">方向</span>
            <select
              value={draft.orientation}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  orientation: e.target.value as PageSettings["orientation"],
                }))
              }
              className="h-9 w-full rounded border border-line bg-paper-card px-2.5 text-sm text-ink focus:border-line-hover focus:outline-none"
            >
              <option value="portrait">纵向</option>
              <option value="landscape">横向</option>
            </select>
          </label>
        </div>
        <div className="space-y-2.5 rounded-md border border-line bg-paper-card p-3">
          <Field
            label="上边距"
            value={draft.margin.top}
            onChange={(v) => setDraft((d) => ({ ...d, margin: { ...d.margin, top: v } }))}
          />
          <Field
            label="下边距"
            value={draft.margin.bottom}
            onChange={(v) => setDraft((d) => ({ ...d, margin: { ...d.margin, bottom: v } }))}
          />
          <Field
            label="左边距"
            value={draft.margin.left}
            onChange={(v) => setDraft((d) => ({ ...d, margin: { ...d.margin, left: v } }))}
          />
          <Field
            label="右边距"
            value={draft.margin.right}
            onChange={(v) => setDraft((d) => ({ ...d, margin: { ...d.margin, right: v } }))}
          />
        </div>
      </div>
    </Dialog>
  );
}
