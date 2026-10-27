import { useLayoutEffect, useRef, useState } from "react";
import { EditorContent } from "@tiptap/react";
import type { PageSettings } from "../../lib/types";
import { useDocument } from "../../hooks/useDocument";
import { useAppSettings } from "../../hooks/useAppSettings";
import { useTheme } from "../../hooks/useTheme";
import type { OpenSession } from "../../lib/router";
import { EditorTopbar, type SaveStatus } from "./editorTopbar";
import { EditorBubbleMenu } from "./bubbleMenu";
import { FindReplaceBar } from "./findReplaceBar";
import { StatusBar } from "./statusBar";
import { OutlinePanel } from "./outlinePanel";
import { PageSettingsDialog } from "./pageSettingsDialog";
import { LoaderCircle } from "lucide-react";

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
  children: React.ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [innerH, setInnerH] = useState(0);
  const scale = zoom / 100;
  const { w, h } = PAGE_PX[page.size];
  const landscape = page.orientation === "landscape";
  const pageW = landscape ? h : w;
  const pageH = landscape ? w : h;

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setInnerH(el.offsetHeight);
    });
    ro.observe(el);
    setInnerH(el.offsetHeight);
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
              padding: `${ptToPx(page.margin.top)}px ${ptToPx(page.margin.right)}px ${ptToPx(page.margin.bottom)}px ${ptToPx(page.margin.left)}px`,
            }}
          >
            {children}
          </div>
        </div>
      </div>
      <div className="h-24 shrink-0" />
    </div>
  );
}

export function EditorPage({ session }: { session: OpenSession }) {
  const doc = useDocument(session);
  const { settings, loaded: settingsLoaded, update } = useAppSettings();
  const { mode, toggle } = useTheme();
  const [pageDialogOpen, setPageDialogOpen] = useState(false);
  const zoom = settingsLoaded ? settings.zoom : 100;

  const saveStatus: SaveStatus = doc.saving
    ? "saving"
    : doc.dirty
      ? "dirty"
      : doc.fileBacked
        ? "saved"
        : "unsaved";

  const savedText = saveStatus === "unsaved" ? "未保存到文件" : saveStatus === "saved" ? "已保存" : saveStatus === "dirty" ? "有未保存的修改" : "保存中…";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <EditorTopbar
        editor={doc.editor}
        title={doc.title}
        setTitle={doc.setTitle}
        ref={doc.ref}
        saveStatus={saveStatus}
        palette={doc.palette}
        dark={mode === "dark"}
        onToggleTheme={toggle}
        onGoHome={() => void doc.goHome()}
        onSaveNow={() => void doc.saveNow()}
        onExportDocx={() => void doc.exportAsDocx()}
        onPrint={() => doc.print()}
        onInsertImage={() => void doc.insertImage()}
        onOpenOutline={() => update({ outlineOpen: true })}
        onOpenPageSettings={() => setPageDialogOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        <main className="editor-scroll min-w-0 flex-1 overflow-y-auto">
          {doc.loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-muted">
              <LoaderCircle size={22} strokeWidth={2} className="animate-spin" />
              <span className="text-sm">正在打开文档…</span>
            </div>
          ) : (
            <ScaledCanvas zoom={zoom} page={doc.page}>
              {doc.editor ? <EditorContent editor={doc.editor} /> : null}
            </ScaledCanvas>
          )}
        </main>

        {settingsLoaded && settings.outlineOpen ? (
          <OutlinePanel
            editor={doc.editor}
            onClose={() => update({ outlineOpen: false })}
          />
        ) : null}
      </div>

      <StatusBar
        editor={doc.editor}
        zoom={zoom}
        setZoom={(z) => update({ zoom: z })}
        savedText={savedText}
      />

      {doc.editor ? (
        <>
          <EditorBubbleMenu
            editor={doc.editor}
            palette={doc.palette}
            onReplaceImage={() => void doc.insertImage()}
          />
          {doc.findOpen ? (
            <FindReplaceBar editor={doc.editor} onClose={() => doc.setFindOpen(false)} />
          ) : null}
        </>
      ) : null}

      <PageSettingsDialog
        open={pageDialogOpen}
        onClose={() => setPageDialogOpen(false)}
        page={doc.page}
        onApply={(p) => {
          doc.updatePageSettings({
            size: p.size,
            orientation: p.orientation,
            margin: { ...p.margin },
          });
        }}
      />
    </div>
  );
}
