import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import type { DocRef, PageSettings, SowdDoc } from "../lib/types";
import { refKey } from "../lib/types";
import { createSowd, parseSowd, serializeSowd, stripExt } from "../lib/sowd";
import { fileService } from "../lib/storage";
import { deleteDraft, getDraft, putDraft, touchRecent } from "../lib/db";
import { importDocx, exportDocx } from "../lib/docx";
import { buildExtensions } from "../components/editor/extensions";
import { toast } from "../components/ui/toast";
import { openConfirm, openConfirm3, openAlert } from "../components/ui/dialog";
import { navigate, type OpenSession } from "../lib/router";
import { uuid } from "../lib/format";

const AUTOSAVE_MS = 1200;

function loadImageSize(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 500;
      const w = Math.min(img.naturalWidth || 300, maxW);
      const h = Math.round(((img.naturalHeight || 200) * w) / (img.naturalWidth || 300));
      resolve({ width: w, height: h });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export interface UseDocumentResult {
  loading: boolean;
  editor: Editor | null;
  ref: DocRef | null;
  title: string;
  page: PageSettings;
  palette: string[];
  dirty: boolean;
  saving: boolean;
  savedAt: number | null;
  fileBacked: boolean;
  setTitle: (t: string) => void;
  saveNow: () => Promise<void>;
  saveAs: () => Promise<boolean>;
  exportAsDocx: () => Promise<void>;
  print: () => void;
  insertImage: () => Promise<void>;
  goHome: () => Promise<void>;
  updatePageSettings: (patch: Partial<PageSettings>) => void;
  updatePalette: (palette: string[]) => void;
  openFind: () => void;
  findOpen: boolean;
  setFindOpen: (v: boolean) => void;
}

export function useDocument(session: OpenSession): UseDocumentResult {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [ref, setRef] = useState<DocRef | null>(session.ref);
  const [sowd, setSowd] = useState<SowdDoc | null>(session.sowd ?? null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [title, setTitleState] = useState(
    session.sowd?.meta.title ?? session.ref?.name ?? "未命名文档",
  );

  const sessionKey = useMemo(() => uuid(), []);
  const unsavedKey = useMemo(() => `unsaved:${sessionKey}`, [sessionKey]);

  const editorRef = useRef<Editor | null>(null);
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const lastFileMtime = useRef<number | null>(session.mtime ?? null);
  const loadedRef = useRef(false);

  const setEditorBoth = useCallback((e: Editor | null) => {
    editorRef.current = e;
    setEditor(e);
  }, []);

  /* ---------- 加载文档（含草稿恢复） ---------- */
  useEffect(() => {
    let alive = true;
    let newRef: DocRef | null = session.ref;
    let doc: SowdDoc;

    (async () => {
      if (session.sowd) {
        doc = session.sowd;
      } else if (session.needOpen && session.ref) {
        const opened = await fileService.openRef(session.ref);
        if (!opened) {
          if (alive) {
            openAlert({ title: "无法打开文件", description: "文件可能已被移动或删除。" });
            navigate({ page: "home" });
          }
          return;
        }
        if (opened.kind === "docx") {
          try {
            const content = await importDocx(opened.bytes!);
            doc = createSowd(stripExt(opened.ref.name));
            doc.content = content;
            newRef = null;
            if (alive) toast("info", "已从 Word 文档导入，保存时将存为 .sowd");
          } catch {
            if (alive) {
              openAlert({ title: "导入失败", description: "无法解析该 .docx 文件。" });
              navigate({ page: "home" });
            }
            return;
          }
        } else {
          try {
            doc = parseSowd(opened.text);
          } catch (err) {
            if (alive) {
              openAlert({
                title: "无法打开文档",
                description: err instanceof Error ? err.message : "文件格式不支持。",
              });
              navigate({ page: "home" });
            }
            return;
          }
          lastFileMtime.current = opened.mtime;
        }
      } else {
        doc = createSowd(session.ref?.name ?? "未命名文档");
        newRef = null;
      }

      // 草稿恢复判断（仅文件型文档）
      if (newRef && (newRef.kind === "tauri" || newRef.kind === "web")) {
        const draft = await getDraft(refKey(newRef));
        if (draft && draft.updatedAt > (lastFileMtime.current ?? 0)) {
          const restore = await openConfirm({
            title: "发现未保存的草稿",
            description: `「${draft.title}」存在比文件更新的草稿，是否恢复草稿内容？`,
            confirmText: "恢复草稿",
            cancelText: "使用文件内容",
          });
          if (restore) {
            try {
              doc = parseSowd(draft.doc);
            } catch {
              /* 草稿损坏则用文件内容 */
            }
          }
        }
      }

      if (!alive) return;
      setSowd(doc);
      setRef(newRef);
      setTitleState(doc.meta.title);
      setLoading(false);
      loadedRef.current = true;

      if (newRef) {
        void touchRecent({
          key: refKey(newRef),
          title: doc.meta.title,
          kind: newRef.kind,
          path: newRef.kind === "tauri" ? newRef.path : undefined,
          handleId: newRef.kind === "web" ? newRef.handleId : undefined,
        });
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  /* ---------- 编辑器创建 ---------- */
  const insertImageRef = useRef<() => Promise<void>>(async () => {});
  const actionsRef = useRef({
    saveNow: async () => {},
    saveAs: async () => false,
    print: () => {},
    openFind: () => {},
  });

  useEffect(() => {
    if (!sowd || loading) return;
    const ed = new Editor({
      extensions: buildExtensions({
        onInsertImage: () => {
          void insertImageRef.current();
        },
      }),
      content: (sowd.content as JSONContent | null) ?? undefined,
      editorProps: {
        attributes: {
          class: "page-content",
          spellcheck: "false",
          autocorrect: "off",
          autocapitalize: "off",
        },
        handleKeyDown: (_view, event) => {
          const mod = event.ctrlKey || event.metaKey;
          if (!mod) return false;
          if (event.key.toLowerCase() === "s") {
            event.preventDefault();
            if (event.shiftKey) void actionsRef.current.saveAs();
            else void actionsRef.current.saveNow();
            return true;
          }
          if (event.key.toLowerCase() === "p") {
            event.preventDefault();
            actionsRef.current.print();
            return true;
          }
          if (event.key.toLowerCase() === "f") {
            event.preventDefault();
            actionsRef.current.openFind();
            return true;
          }
          return false;
        },
      },
      onCreate: ({ editor: e }) => {
        if (!session.sowd) {
          requestAnimationFrame(() => e.commands.focus("start"));
        }
      },
      onUpdate: ({ transaction }) => {
        if (!transaction.docChanged) return;
        dirtyRef.current = true;
        setDirty(true);
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          void persistRef.current(true);
        }, AUTOSAVE_MS);
      },
    });
    setEditorBoth(ed);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      ed.destroy();
      setEditorBoth(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sowd, loading]);

  /* ---------- 持久化 ---------- */
  const buildDoc = useCallback((): SowdDoc => {
    const base = sowdRef.current ?? createSowd(titleRef.current);
    return {
      ...base,
      meta: {
        ...base.meta,
        title: titleRef.current,
        updatedAt: Date.now(),
      },
      content: editorRef.current ? editorRef.current.getJSON() : base.content,
    };
  }, []);

  const sowdRef = useRef<SowdDoc | null>(null);
  const titleRef = useRef(title);
  const refRef = useRef<DocRef | null>(ref);
  sowdRef.current = sowd;
  titleRef.current = title;
  refRef.current = ref;

  const touchRecentSafe = useCallback(async (r: DocRef, docTitle: string) => {
    await touchRecent({
      key: refKey(r),
      title: docTitle,
      kind: r.kind,
      path: r.kind === "tauri" ? r.path : undefined,
      handleId: r.kind === "web" ? r.handleId : undefined,
    });
  }, []);

  const persist = useCallback(async (toFile: boolean) => {
    const r = refRef.current;
    const doc = buildDoc();
    const text = serializeSowd(doc);
    const key = r ? refKey(r) : unsavedKey;
    await putDraft({
      key,
      title: doc.meta.title,
      doc: text,
      updatedAt: Date.now(),
      fileMtime: lastFileMtime.current ?? undefined,
    });
    if (toFile && r && (r.kind === "tauri" || r.kind === "web")) {
      setSaving(true);
      try {
        const mtime = await fileService.saveTo(r, text);
        lastFileMtime.current = mtime ?? lastFileMtime.current;
        await putDraft({
          key,
          title: doc.meta.title,
          doc: text,
          updatedAt: Date.now(),
          fileMtime: lastFileMtime.current ?? undefined,
        });
        if (!dirtyRef.current) setDirty(false);
        setSavedAt(Date.now());
        await touchRecentSafe(r, doc.meta.title);
      } catch (err) {
        console.error(err);
        toast("error", "保存失败，请检查文件权限");
      } finally {
        setSaving(false);
      }
    }
    if (dirtyRef.current && timerRef.current === null) {
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void persistRef.current(true);
      }, AUTOSAVE_MS);
    }
  }, [buildDoc, touchRecentSafe, unsavedKey]);

  const persistRef = useRef(persist);
  persistRef.current = persist;

  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const r = refRef.current;
    if (!r || r.kind === "unsaved" || r.kind === "web-name") {
      await saveAsRef.current();
      return;
    }
    await persistRef.current(true);
  }, []);

  const saveNowRef = useRef(saveNow);
  saveNowRef.current = saveNow;

  const saveAs = useCallback(async (): Promise<boolean> => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const doc = buildDoc();
    const text = serializeSowd(doc);
    const name = stripExt(doc.meta.title) || "未命名文档";
    const newRef = await fileService.saveAs(text, { name, ext: "sowd" });
    if (!newRef) return false;
    const oldKey = refRef.current ? refKey(refRef.current) : unsavedKey;
    setRef(newRef);
    refRef.current = newRef;
    if (oldKey !== refKey(newRef)) {
      await deleteDraft(oldKey);
    }
    lastFileMtime.current = null;
    dirtyRef.current = false;
    setDirty(false);
    setSavedAt(Date.now());
    await putDraft({
      key: refKey(newRef),
      title: doc.meta.title,
      doc: text,
      updatedAt: Date.now(),
    });
    await touchRecentSafe(newRef, doc.meta.title);
    toast("success", `已保存到 ${newRef.name}`);
    return true;
  }, [buildDoc, unsavedKey, touchRecentSafe]);

  const saveAsRef = useRef(saveAs);
  saveAsRef.current = saveAs;

  const exportAsDocx = useCallback(async () => {
    const doc = buildDoc();
    try {
      toast("info", "正在导出…");
      const blob = await exportDocx({
        title: doc.meta.title,
        content: doc.content,
        settings: { page: doc.settings.page },
      });
      const name = stripExt(doc.meta.title) || "未命名文档";
      const saved = await fileService.saveAs(blob, { name, ext: "docx" });
      if (saved) toast("success", `已导出 ${saved.name}`);
    } catch (err) {
      console.error(err);
      toast("error", "导出 .docx 失败");
    }
  }, [buildDoc]);

  const pageRef = useRef<PageSettings>({
    size: "A4",
    orientation: "portrait",
    margin: { top: 72, right: 72, bottom: 72, left: 72 },
  });
  if (sowd) pageRef.current = sowd.settings.page;

  const doPrint = useCallback(() => {
    const m = pageRef.current.margin;
    const mm = (pt: number) => `${((pt * 25.4) / 72).toFixed(1)}mm`;
    const style = document.createElement("style");
    style.id = "sw-print-page";
    style.textContent = `@page { margin: ${mm(m.top)} ${mm(m.right)} ${mm(m.bottom)} ${mm(m.left)}; }`;
    document.head.appendChild(style);
    const after = () => {
      style.remove();
      window.removeEventListener("afterprint", after);
    };
    window.addEventListener("afterprint", after);
    window.print();
  }, []);

  const insertImage = useCallback(async () => {
    const picked = await fileService.pickImage();
    if (!picked) return;
    const size = await loadImageSize(picked.dataUrl);
    editorRef.current
      ?.chain()
      .focus()
      .setImage({
        src: picked.dataUrl,
        alt: picked.name,
        ...(size ?? {}),
      })
      .run();
  }, []);

  insertImageRef.current = insertImage;

  const updatePageSettings = useCallback((patch: Partial<PageSettings>) => {
    setSowd((s) => {
      if (!s) return s;
      return { ...s, settings: { page: { ...s.settings.page, ...patch } } };
    });
  }, []);

  const updatePalette = useCallback((palette: string[]) => {
    setSowd((s) => (s ? { ...s, styles: { palette } } : s));
  }, []);

  const setTitle = useCallback((t: string) => {
    setTitleState(t);
    // 轻量同步到最近列表标题
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void persistRef.current(refRef.current !== null);
      const r = refRef.current;
      if (r && r.kind !== "unsaved") void touchRecentSafe(r, t);
    }, AUTOSAVE_MS);
  }, [touchRecentSafe]);

  actionsRef.current = {
    saveNow,
    saveAs,
    print: doPrint,
    openFind: () => setFindOpen(true),
  };

  const goHome = useCallback(async () => {
    if (!dirtyRef.current) {
      navigate({ page: "home" });
      return;
    }
    const choice = await openConfirm3({
      title: "有未保存的修改",
      description: "是否在离开前保存更改？",
    });
    if (choice === "cancel") return;
    if (choice === "save") {
      const r = refRef.current;
      if (r && (r.kind === "tauri" || r.kind === "web")) {
        await persistRef.current(true);
      } else {
        await saveAsRef.current();
      }
      navigate({ page: "home" });
      return;
    }
    // discard
    const key = refRef.current ? refKey(refRef.current) : unsavedKey;
    await deleteDraft(key);
    navigate({ page: "home" });
  }, [unsavedKey]);

  /* ---------- 卸载前兜底保存草稿 + beforeunload ---------- */
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (!loadedRef.current || !dirtyRef.current) return;
      // 离开时若尚未保存，兜底镜像草稿
      const doc = buildDoc();
      void putDraft({
        key: refRef.current ? refKey(refRef.current) : unsavedKey,
        title: doc.meta.title,
        doc: serializeSowd(doc),
        updatedAt: Date.now(),
        fileMtime: lastFileMtime.current ?? undefined,
      });
    };
  }, [buildDoc, unsavedKey]);

  return {
    loading,
    editor,
    ref,
    title,
    page: sowd?.settings.page ?? { size: "A4", orientation: "portrait", margin: { top: 72, right: 72, bottom: 72, left: 72 } },
    palette: sowd?.styles.palette ?? [],
    dirty,
    saving,
    savedAt,
    fileBacked: ref !== null && (ref.kind === "tauri" || ref.kind === "web"),
    setTitle,
    saveNow,
    saveAs,
    exportAsDocx,
    print: doPrint,
    insertImage,
    goHome,
    updatePageSettings,
    updatePalette,
    openFind: () => setFindOpen(true),
    findOpen,
    setFindOpen,
  };
}
