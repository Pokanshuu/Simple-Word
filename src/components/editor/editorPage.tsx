import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent } from "@tiptap/react";
import { Image as ImageIcon, LoaderCircle, X } from "lucide-react";
import type { PageSettings } from "../../lib/types";
import { useDocument } from "../../hooks/useDocument";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useTheme } from "../../hooks/useTheme";
import type { OpenSession } from "../../lib/router";
import type { SaveStatus } from "./editorTopbar";
import { EditorTopbar } from "./editorTopbar";
import { EditorBubbleMenu } from "./bubbleMenu";
import { FindReplaceBar } from "./findReplaceBar";
import { StatusBar } from "./statusBar";
import { OutlinePanel } from "./outlinePanel";
import { PageSettingsDialog } from "./pageSettingsDialog";
import { useImageDrop } from "./useImageDrop";
import { toast } from "../ui/toast";

const PAGE_PX: Record<PageSettings["size"], { w: number; h: number }> = {
  A4: { w: 794, h: 1123 },
  Letter: { w: 816, h: 1056 },
};

function ptToPx(pt: number): number {
  return Math.round((pt * 96) / 72);
}

function ScaledCanvas({
  zoom,
  page,
  children,
}: {
  zoom: number;
  page: PageSettings;
  children: ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [innerH, setInnerH] = useState(0);
  const scale = zoom / 100;
  const { w, h } = PAGE_PX[page.size] ?? PAGE_PX.A4;
  const landscape = page.orientation === "landscape";
  const pageW = landscape ? h : w;
  const pageH = landscape ? w : h;

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setInnerH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageW, pageH]);

  return (
    <div className="editor-canvas flex flex-col items-center px-6 py-10">
      <div
        className="sw-scaled-outer relative shrink-0"
        style={{
          width: Math.round(pageW * scale),
          height: Math.max(Math.round(innerH * scale), Math.round(pageH * scale)),
        }}
      >
        <div
          ref={innerRef}
          className="sw-scaled-inner absolute left-0 top-0"
          style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: pageW }}
        >
          <div
            className="page"
            style={{
              width: pageW,
              minHeight: pageH,
              // 让 ProseMirror 填满纸张的可用高度：否则正文只有一两行时，
              // 点击纸张下半部分无法把光标放过去（旧版就是这样）。
              ["--page-content-min" as string]: `${Math.max(
                0,
                pageH - ptToPx(page.margin.top) - ptToPx(page.margin.bottom),
              )}px`,
              padding: `${ptToPx(page.margin.top)}px ${ptToPx(page.margin.right)}px ${ptToPx(page.margin.bottom)}px ${ptToPx(page.margin.left)}px`,
            }}
          >
            {children}
          </div>
        </div>
      </div>
      <div className="h-20 shrink-0" />
    </div>
  );
}

export function EditorPage({ session }: { session: OpenSession }) {
  const doc = useDocument(session);
  const { settings, loaded: settingsLoaded, update } = useAppSettings();
  const { mode, toggle } = useTheme();
  const [pageDialogOpen, setPageDialogOpen] = useState(false);
  const imageDrop = useImageDrop(doc.editor);
  const zoom = settingsLoaded ? settings.zoom : 100;

  useEffect(() => {
    const previous = document.title;
    document.title = doc.title ? `${doc.title} · Simple Word` : "Simple Word";
    return () => {
      document.title = previous;
    };
  }, [doc.title]);

  const saveStatus: SaveStatus = doc.saveError
    ? "error"
    : doc.saving
      ? "saving"
      : doc.dirty
        ? "dirty"
        : doc.fileBacked
          ? "saved"
          : "unsaved";

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <EditorTopbar
        editor={doc.editor}
        title={doc.title}
        setTitle={doc.setTitle}
        ref={doc.ref}
        saveStatus={saveStatus}
        savedAt={doc.savedAt}
        palette={doc.palette}
        dark={mode === "dark"}
        outlineOpen={settings.outlineOpen}
        onToggleTheme={toggle}
        onGoHome={() => void doc.goHome()}
        onSaveNow={() => void doc.saveNow()}
        onSaveAs={() => void doc.saveAs()}
        onExportDocx={() => void doc.exportAsDocx()}
        onPrint={doc.print}
        onInsertImage={() => void doc.insertImage()}
        onInsertTable={(rows, cols) =>
          doc.editor
            ?.chain()
            .focus()
            .insertTable({ rows, cols, withHeaderRow: true })
            .run()
        }
        onOpenFind={() => doc.setFindOpen(true)}
        onOpenOutline={() => update({ outlineOpen: !settings.outlineOpen })}
        onOpenPageSettings={() => setPageDialogOpen(true)}
        onWarn={(message) => toast("error", message)}
      />

      <div className="flex min-h-0 flex-1">
        <main
          className="editor-scroll relative min-w-0 flex-1 overflow-auto"
          data-dragging={imageDrop.dragging ? "on" : "off"}
        >
          {doc.loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-muted">
              <LoaderCircle size={20} strokeWidth={1.8} className="animate-spin" />
              <span className="text-xs tracking-wide">正在打开文档…</span>
            </div>
          ) : (
            <ScaledCanvas zoom={zoom} page={doc.page}>
              {doc.editor ? <EditorContent editor={doc.editor} /> : null}
            </ScaledCanvas>
          )}

          {imageDrop.notice ? (
            <div
              className="we-notice absolute left-1/2 top-4 z-20 flex max-w-[min(560px,calc(100%-32px))] -translate-x-1/2 items-start gap-2 rounded-[4px] border border-line bg-paper px-3 py-2 text-[12px] text-ink"
              data-kind={imageDrop.notice.kind}
              style={{ boxShadow: "0 8px 28px rgba(35, 30, 24, 0.10)" }}
              role="status"
            >
              <ImageIcon size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-ink-faint" />
              <span className="min-w-0 flex-1 leading-relaxed">{imageDrop.notice.text}</span>
              <button
                type="button"
                aria-label="关闭提示"
                className="shrink-0 rounded-[2px] text-ink-faint hover:text-ink"
                onClick={imageDrop.clearNotice}
              >
                <X size={13} strokeWidth={2} />
              </button>
            </div>
          ) : null}

          {imageDrop.dragging ? (
            <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-[3px] border border-dashed border-line-hover bg-paper/70">
              <span className="rounded-[3px] border border-line bg-paper px-3 py-1.5 text-xs text-ink-muted">
                松开以插入图片
              </span>
            </div>
          ) : null}
        </main>

        {settingsLoaded && settings.outlineOpen ? (
          <OutlinePanel editor={doc.editor} onClose={() => update({ outlineOpen: false })} />
        ) : null}
      </div>

      <StatusBar
        editor={doc.editor}
        page={doc.page}
        zoom={zoom}
        setZoom={(z) => update({ zoom: z })}
      />

      {doc.editor ? (
        <>
          <EditorBubbleMenu
            editor={doc.editor}
            palette={doc.palette}
            onReplaceImage={() => void doc.insertImage()}
            onWarn={(message) => toast("error", message)}
          />
          {doc.findOpen ? (
            <FindReplaceBar
              editor={doc.editor}
              onClose={() => doc.setFindOpen(false)}
              onResult={(message) => toast("info", message)}
            />
          ) : null}
        </>
      ) : null}

      <PageSettingsDialog
        open={pageDialogOpen}
        onClose={() => setPageDialogOpen(false)}
        page={doc.page}
        onApply={(next) => {
          doc.updatePageSettings({
            size: next.size,
            orientation: next.orientation,
            margin: { ...next.margin },
          });
        }}
      />
    </div>
  );
}
