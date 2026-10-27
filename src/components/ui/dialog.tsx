import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";

interface DialogState {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onResult: (ok: boolean) => void;
  __id: number;
}

let state: DialogState | null = null;
const subs = new Set<() => void>();
let currentId = 0;

function emit() {
  subs.forEach((cb) => cb());
}

export function openConfirm(opts: {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const id = currentId++;
    state = {
      ...opts,
      onResult: (ok) => {
        if (state?.__id === id) {
          state = null;
          emit();
        }
        resolve(ok);
      },
      __id: id,
    } as DialogState;
    emit();
  });
}

export function openAlert(opts: { title: string; description?: string }): Promise<void> {
  return openConfirm({ ...opts, confirmText: "知道了", cancelText: "" }).then(() => undefined);
}

interface TripleState {
  title: string;
  description?: string;
  confirmText: string;
  neutralText: string;
  onResult: (r: "save" | "discard" | "cancel") => void;
  __id: number;
}

let tripleState: TripleState | null = null;
const tripleSubs = new Set<() => void>();

function tripleEmit() {
  tripleSubs.forEach((cb) => cb());
}

export function openConfirm3(opts: {
  title: string;
  description?: string;
  confirmText?: string;
  neutralText?: string;
}): Promise<"save" | "discard" | "cancel"> {
  return new Promise((resolve) => {
    const id = currentId++;
    tripleState = {
      ...opts,
      confirmText: opts.confirmText ?? "保存",
      neutralText: opts.neutralText ?? "不保存",
      onResult: (r) => {
        if (tripleState?.__id === id) {
          tripleState = null;
          tripleEmit();
        }
        resolve(r);
      },
      __id: id,
    };
    tripleEmit();
  });
}

interface DialogHostState extends DialogState {
  __id: number;
}

export function DialogHost() {
  const [dialog, setDialog] = useState<DialogHostState | null>(null);
  const [triple, setTriple] = useState<TripleState | null>(null);

  useEffect(() => {
    const update = () => setDialog(state as DialogHostState | null);
    subs.add(update);
    return () => {
      subs.delete(update);
    };
  }, []);

  useEffect(() => {
    const update = () => setTriple(tripleState);
    tripleSubs.add(update);
    return () => {
      tripleSubs.delete(update);
    };
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dialog.onResult(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  useEffect(() => {
    if (!triple) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") triple.onResult("cancel");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [triple]);

  const tripleDialog = triple
    ? createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/15 p-4 dark:bg-black/40"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) triple.onResult("cancel");
          }}
        >
          <div
            role="dialog"
            aria-modal
            className="w-full max-w-[380px] rounded-lg border border-line bg-paper/70 p-4 shadow-none ring-1 ring-black/5 backdrop-blur-lg dark:bg-paper/80"
          >
            <h2 className="font-serif text-lg font-bold text-ink">{triple.title}</h2>
            {triple.description ? (
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{triple.description}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <Button onClick={() => triple.onResult("cancel")}>取消</Button>
              <Button variant="danger" onClick={() => triple.onResult("discard")}>
                {triple.neutralText}
              </Button>
              <Button onClick={() => triple.onResult("save")} autoFocus>
                {triple.confirmText}
              </Button>
            </div>
          </div>
        </div>,
        document.getElementById("overlay-root") ?? document.body,
      )
    : null;

  if (!dialog) return <>{tripleDialog}</>;

  const dialogEl = createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/15 p-4 dark:bg-black/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dialog.onResult(false);
      }}
    >
      <div
        role="dialog"
        aria-modal
        className="w-full max-w-[380px] rounded-lg border border-line bg-paper/70 p-4 shadow-none ring-1 ring-black/5 backdrop-blur-lg dark:bg-paper/80"
      >
        <h2 className="font-serif text-lg font-bold text-ink">{dialog.title}</h2>
        {dialog.description ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{dialog.description}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          {dialog.cancelText !== "" ? (
            <Button onClick={() => dialog.onResult(false)}>{dialog.cancelText ?? "取消"}</Button>
          ) : null}
          <Button
            variant={dialog.danger ? "danger" : "default"}
            onClick={() => dialog.onResult(true)}
            autoFocus
          >
            {dialog.confirmText ?? "确定"}
          </Button>
        </div>
      </div>
    </div>,
    document.getElementById("overlay-root") ?? document.body,
  );

  return (
    <>
      {tripleDialog}
      {dialogEl}
    </>
  );
}

/** 简易受控弹窗（用于设置面板等） */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  width = 420,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/15 p-4 dark:bg-black/40"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal
        style={{ width }}
        className="max-w-[calc(100vw-32px)] rounded-lg border border-line bg-paper/70 p-4 shadow-none ring-1 ring-black/5 backdrop-blur-lg dark:bg-paper/80"
      >
        <h2 className="font-serif text-lg font-bold text-ink">{title}</h2>
        <div className="mt-3">{children}</div>
        {footer ? <div className="mt-4 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>,
    document.getElementById("overlay-root") ?? document.body,
  );
}
