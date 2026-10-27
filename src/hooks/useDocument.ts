import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import type { DocRef, PageSettings, SowdDoc } from "../lib/types";
import { refKey } from "../lib/types";
import {
  createSowd,
  normalizePageSettings,
  parseSowd,
  serializeSowd,
  stripExt,
} from "../lib/sowd";
import { fileService } from "../lib/storage";
import { deleteDraft, getDraft, putDraft, touchRecent } from "../lib/db";
import { importDocx, exportDocx } from "../lib/docx";
import { buildExtensions } from "../components/editor/extensions";
import { toast } from "../components/ui/toast";
import { openConfirm, openConfirm3, openAlert } from "../components/ui/dialog";
import { navigate, type OpenSession } from "../lib/router";
import { uuid } from "../lib/format";
import { hydrateImageSizes, prepareImageDataUrl } from "../lib/image";
import { normalizeDocContent } from "../lib/sanitize";

const AUTOSAVE_MS = 1200;

function isFileBacked(ref: DocRef | null): ref is Extract<DocRef, { kind: "tauri" | "web" }> {
  return !!ref && (ref.kind === "tauri" || ref.kind === "web");
}

/**
 * 新建文档的草稿 key 需要跨刷新、跨重启稳定。
 *
 * sessionStorage 在应用重启后会清空，之前用它的结果是：崩溃/断电后 IndexedDB
 * 里明明躺着草稿，下一次启动却生成新 key，永远读不回来。桌面是单窗口应用，
 * 用 localStorage 记最后一个未保存草稿的 key 更符合恢复预期。
 */
function stableUnsavedKey(): string {
  try {
    const existing = localStorage.getItem("sw-unsaved-key");
    if (existing) return `unsaved:${existing}`;
    // 兼容上一版只写 sessionStorage 的会话：先迁到 localStorage
    const legacy = sessionStorage.getItem("sw-unsaved-key");
    if (legacy) {
      localStorage.setItem("sw-unsaved-key", legacy);
      return `unsaved:${legacy}`;
    }
    const next = uuid();
    localStorage.setItem("sw-unsaved-key", next);
    return `unsaved:${next}`;
  } catch {
    return `unsaved:${uuid()}`;
  }
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
  saveError: boolean;
  savedAt: number | null;
  fileBacked: boolean;
  setTitle: (t: string) => void;
  saveNow: () => Promise<boolean>;
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
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [title, setTitleState] = useState(
    session.sowd?.meta.title ?? session.ref?.name ?? "未命名文档",
  );
  const [page, setPage] = useState<PageSettings>(
    normalizePageSettings(session.sowd?.settings.page),
  );
  const [palette, setPalette] = useState<string[]>(session.sowd?.styles.palette ?? []);
  const [docEpoch, setDocEpoch] = useState(0);

  const unsavedKey = useMemo(stableUnsavedKey, []);

  const editorRef = useRef<Editor | null>(null);
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const lastFileMtime = useRef<number | null>(session.mtime ?? null);
  const loadedRef = useRef(false);

  const baseDocRef = useRef<SowdDoc | null>(null);
  /** 编辑器销毁前最后一次快照：卸载兜底写草稿时 editorRef 已经被清空 */
  const lastContentRef = useRef<JSONContent | null>(null);
  const focusStartRef = useRef(false);
  const pageRef = useRef<PageSettings>(page);
  const paletteRef = useRef<string[]>(palette);
  const titleRef = useRef(title);
  const refRef = useRef<DocRef | null>(ref);

  // revision 只在"内容/标题/页面设置"真正变化时递增。保存时记下版本，
  // 写完再比一次：期间用户又改了字，就不能把 dirty 清掉（旧版永远清不掉）。
  const revisionRef = useRef(0);
  const savedRevisionRef = useRef(0);

  pageRef.current = page;
  paletteRef.current = palette;
  titleRef.current = title;
  refRef.current = ref;

  const setEditorBoth = useCallback((value: Editor | null) => {
    editorRef.current = value;
    setEditor(value);
  }, []);

  /* ---------- 载入文档（含草稿恢复） ---------- */
  useEffect(() => {
    let alive = true;
    let newRef: DocRef | null = session.ref;
    let doc: SowdDoc;
    let focusStart = false;
    let restoredDraft = false;

    setLoading(true);
    lastFileMtime.current = session.mtime ?? null;

    (async () => {
      try {
        if (session.sowd) {
          doc = session.sowd;
          focusStart = Boolean(session.importedFromDocx);
        } else if (session.needOpen && session.ref) {
          const opened = await fileService.openRef(session.ref);
          if (!opened) {
            if (alive) {
              openAlert({ title: "无法打开文件", description: "文件可能已被移动、删除或没有读取权限。" });
              navigate({ page: "home" });
            }
            return;
          }
          if (opened.kind === "docx") {
            const imported = await importDocx(opened.bytes!);
            doc = createSowd(stripExt(opened.ref.name));
            doc.content = imported.content;
            newRef = null;
            focusStart = true;
            if (alive) {
              toast("info", "已从 Word 文档导入，保存时将存为 .sowd");
              if (imported.warnings.length) toast("warning", imported.warnings[0]);
            }
          } else {
            doc = parseSowd(opened.text);
            lastFileMtime.current = opened.mtime;
          }
        } else {
          doc = createSowd(session.ref?.name ?? "未命名文档");
          newRef = null;
          focusStart = true;
        }

        // 草稿恢复判断（仅文件型文档；新建文档的草稿由 unmount 兜底）
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
                focusStart = false;
                restoredDraft = true;
              } catch {
                /* 草稿损坏则用文件内容 */
              }
            }
          }
        } else if (!newRef && !session.sowd) {
          // 新建文档没有文件 mtime 可比，但上一轮崩溃镜像的草稿仍应可恢复。
          // unsavedKey 放在 sessionStorage 里，刷新后还是同一个 key。
          const draft = await getDraft(unsavedKey);
          if (draft) {
            const restore = await openConfirm({
              title: "发现未保存的草稿",
              description: `「${draft.title || "未命名文档"}」有 ${new Date(
                draft.updatedAt,
              ).toLocaleString("zh-CN")} 的草稿，是否继续编辑？`,
              confirmText: "恢复草稿",
              cancelText: "新建空白文档",
            });
            if (restore) {
              try {
                doc = parseSowd(draft.doc);
                restoredDraft = true;
              } catch {
                /* 草稿损坏则开空白文档 */
              }
            } else {
              await deleteDraft(unsavedKey);
            }
          }
        }

        if (!alive) return;

        doc.settings = { page: normalizePageSettings(doc.settings?.page) };
        doc.content = await hydrateImageSizes(normalizeDocContent(doc.content));
        lastContentRef.current = doc.content;

        baseDocRef.current = doc;
        pageRef.current = doc.settings.page;
        paletteRef.current = doc.styles.palette;
        titleRef.current = doc.meta.title;
        refRef.current = newRef;

        setPage(doc.settings.page);
        setPalette(doc.styles.palette);
        setTitleState(doc.meta.title);
        setRef(newRef);
        setDirty(restoredDraft);
        dirtyRef.current = restoredDraft;
        setSaving(false);
        setSaveError(false);
        setSavedAt(null);
        revisionRef.current = restoredDraft ? 1 : 0;
        savedRevisionRef.current = 0;
        loadedRef.current = true;
        setLoading(false);
        setDocEpoch((n) => n + 1);

        // 恢复草稿后按"有未保存修改"处理：1.2s 后自动写回文件/草稿，
        // 状态栏不会在内容还是草稿时显示"已保存"。
        if (restoredDraft) {
          window.setTimeout(() => scheduleSaveRef.current(), 400);
        }

        if (newRef) {
          void touchRecent({
            key: refKey(newRef),
            title: doc.meta.title,
            kind: newRef.kind,
            path: newRef.kind === "tauri" ? newRef.path : undefined,
            handleId: newRef.kind === "web" ? newRef.handleId : undefined,
          }).catch(() => {});
        }
        focusStartRef.current = focusStart;
      } catch (error) {
        if (!alive) return;
        openAlert({
          title: "无法打开文档",
          description: error instanceof Error ? error.message : "文件格式不支持。",
        });
        navigate({ page: "home" });
      }
    })();

    return () => {
      alive = false;
    };
    // 只在 session 变化时重新载入
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  /* ---------- 草稿镜像 ---------- */
  const buildDoc = useCallback((): SowdDoc => {
    const base = baseDocRef.current ?? createSowd(titleRef.current);
    return {
      ...base,
      meta: {
        ...base.meta,
        title: titleRef.current,
        updatedAt: Date.now(),
      },
      settings: {
        page: {
          ...pageRef.current,
          margin: { ...pageRef.current.margin },
        },
      },
      content: editorRef.current
        ? (editorRef.current.getJSON() as JSONContent)
        : (lastContentRef.current ?? base.content),
      styles: { palette: [...paletteRef.current] },
    };
  }, []);

  const touchRecentSafe = useCallback(async (target: DocRef, docTitle: string) => {
    try {
      await touchRecent({
        key: refKey(target),
        title: docTitle,
        kind: target.kind,
        path: target.kind === "tauri" ? target.path : undefined,
        handleId: target.kind === "web" ? target.handleId : undefined,
      });
    } catch {
      /* 最近列表写失败不影响文件保存 */
    }
  }, []);

  const scheduleSaveRef = useRef<() => void>(() => {});
  const persistRef = useRef<(toFile: boolean) => Promise<boolean>>(async () => false);

  const persist = useCallback(
    async (toFile: boolean): Promise<boolean> => {
      const doc = buildDoc();
      const text = serializeSowd(doc);
      const target = refRef.current;
      const key = target ? refKey(target) : unsavedKey;

      let draftOk = true;
      try {
        await putDraft({
          key,
          title: doc.meta.title,
          doc: text,
          updatedAt: Date.now(),
          fileMtime: lastFileMtime.current ?? undefined,
        });
      } catch {
        draftOk = false;
      }

      if (!toFile || !isFileBacked(target)) {
        if (!draftOk) toast("error", "草稿写入失败：本地存储空间可能已满");
        return draftOk;
      }

      if (savingRef.current) {
        pendingSaveRef.current = true;
        return false;
      }

      const revision = revisionRef.current;
      savingRef.current = true;
      setSaving(true);
      setSaveError(false);
      try {
        const mtime = await fileService.saveTo(target, text);
        // Web 端写句柄失败会返回 null；Tauri 的 stat 失败也可能是 null，
        // 但写入本身已抛错，所以只对 web 断言失败。
        if (target.kind === "web" && mtime === null) {
          throw new Error("文件写入失败，请检查文件权限");
        }
        if (typeof mtime === "number") lastFileMtime.current = mtime;

        // 文件已经写好，草稿镜像就没有存在意义了；留着反而会让首页永远显示
        // "草稿"徽标、下次打开永远提示恢复。只有保存失败时才保留草稿。
        if (revisionRef.current === revision) {
          try {
            await deleteDraft(key);
          } catch {
            /* 草稿删不掉不影响已保存的文件 */
          }
        }

        if (revisionRef.current === revision) {
          dirtyRef.current = false;
          savedRevisionRef.current = revision;
          setDirty(false);
        } else {
          // 保存期间又改过：保持 dirty，并再排一次自动保存
          scheduleSaveRef.current();
        }
        setSavedAt(Date.now());
        await touchRecentSafe(target, doc.meta.title);
        return true;
      } catch (error) {
        setSaveError(true);
        toast("error", error instanceof Error ? error.message : "保存失败，请检查文件权限");
        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);
        if (pendingSaveRef.current) {
          pendingSaveRef.current = false;
          scheduleSaveRef.current();
        }
      }
    },
    [buildDoc, touchRecentSafe, unsavedKey],
  );
  persistRef.current = persist;

  const scheduleSave = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void persistRef.current(true);
    }, AUTOSAVE_MS);
  }, []);
  scheduleSaveRef.current = scheduleSave;

  const markDirty = useCallback(() => {
    revisionRef.current += 1;
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setDirty(true);
    }
    setSaveError(false);
    scheduleSaveRef.current();
  }, []);

  /* ---------- 编辑器创建 ---------- */
  const insertImageRef = useRef<() => Promise<void>>(async () => {});
  const actionsRef = useRef({
    saveNow: async (): Promise<boolean> => false,
    saveAs: async (): Promise<boolean> => false,
    print: () => {},
    openFind: () => {},
  });

  useEffect(() => {
    if (docEpoch === 0) return;
    const initial = baseDocRef.current;
    if (!initial) return;

    const ed = new Editor({
      extensions: buildExtensions({
        onInsertImage: () => {
          void insertImageRef.current();
        },
      }),
      content: initial.content ?? undefined,
      editorProps: {
        attributes: {
          class: "page-content",
          role: "textbox",
          "aria-label": "正文",
          "aria-multiline": "true",
          spellcheck: "false",
          autocorrect: "off",
          autocapitalize: "off",
        },
      },
      onUpdate: ({ transaction }) => {
        if (!transaction.docChanged) return;
        markDirty();
      },
    });

    setEditorBoth(ed);
    if (focusStartRef.current) {
      // 必须等 editor 实例挂进 ref 之后再聚焦。旧代码在载入流程里 setTimeout(0)，
      // 有时会早于 editor effect 执行，表现为"新建文档后光标不在正文里"。
      requestAnimationFrame(() => {
        if (editorRef.current === ed) ed.commands.focus("start");
      });
    }
    return () => {
      // 先留一份内容快照：React 会先执行本 effect 的 cleanup，再执行卸载兜底
      // 写草稿的 cleanup；后者读 editorRef 时它已经是 null。
      lastContentRef.current = ed.getJSON() as JSONContent;
      ed.destroy();
      setEditorBoth(null);
    };
    // 每次载入新文档（docEpoch 递增）重建一次；页面设置/色卡变化**不**重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docEpoch]);

  /* ---------- 保存 ---------- */
  const saveAs = useCallback(async (): Promise<boolean> => {
    try {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const doc = buildDoc();
      const text = serializeSowd(doc);
      const name = stripExt(doc.meta.title) || "未命名文档";
      const newRef = await fileService.saveAs(text, { name, ext: "sowd" });
      if (!newRef) return false;

      const oldKey = refRef.current ? refKey(refRef.current) : unsavedKey;
      refRef.current = newRef;
      setRef(newRef);
      baseDocRef.current = doc;

      if (oldKey !== refKey(newRef)) {
        try {
          await deleteDraft(oldKey);
        } catch {
          /* 旧草稿删不掉不影响新文件 */
        }
      }
      lastFileMtime.current = null;
      dirtyRef.current = false;
      savedRevisionRef.current = revisionRef.current;
      setDirty(false);
      setSaveError(false);
      setSavedAt(Date.now());

      try {
        await deleteDraft(refKey(newRef));
      } catch {
        /* 草稿删不掉不影响已保存的文件 */
      }
      await touchRecentSafe(newRef, doc.meta.title);
      toast("success", newRef.kind === "web-name" ? "已下载文档" : `已保存到 ${newRef.name}`);
      return true;
    } catch (error) {
      setSaveError(true);
      toast("error", error instanceof Error ? error.message : "保存失败，请检查文件权限");
      return false;
    }
  }, [buildDoc, touchRecentSafe, unsavedKey]);

  const saveNow = useCallback(async (): Promise<boolean> => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const target = refRef.current;
    if (!isFileBacked(target)) return saveAs();
    return persistRef.current(true);
  }, [saveAs]);

  const exportAsDocx = useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
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
    } catch (error) {
      console.error(error);
      toast("error", "导出 .docx 失败");
    }
  }, [buildDoc]);

  const doPrint = useCallback(() => {
    const p = pageRef.current;
    const m = p.margin;
    const mm = (pt: number) => `${((pt * 25.4) / 72).toFixed(1)}mm`;
    document.getElementById("sw-print-page")?.remove();
    const style = document.createElement("style");
    style.id = "sw-print-page";
    style.textContent = `@page { size: ${p.size} ${p.orientation}; margin: ${mm(m.top)} ${mm(m.right)} ${mm(m.bottom)} ${mm(m.left)}; }`;
    document.head.appendChild(style);
    const after = () => {
      style.remove();
      window.removeEventListener("afterprint", after);
    };
    window.addEventListener("afterprint", after);
    window.print();
  }, []);

  const insertImage = useCallback(async () => {
    try {
      const picked = await fileService.pickImage();
      if (!picked) return;
      const prepared = await prepareImageDataUrl(picked.dataUrl, picked.name);
      const attrs: { src: string; alt?: string; width?: number; height?: number } = {
        src: prepared?.src ?? picked.dataUrl,
        alt: picked.name,
      };
      if (prepared) {
        attrs.width = prepared.width;
        attrs.height = prepared.height;
      }
      const ed = editorRef.current;
      if (!ed) return;
      const { selection } = ed.state;
      const replacing = selection instanceof NodeSelection && selection.node.type.name === "image";
      if (replacing) {
        ed.chain().focus().deleteSelection().setImage(attrs).run();
      } else {
        ed.chain().focus().setImage(attrs).run();
      }
      if (prepared?.recompressed) {
        const saved = Math.max(0, prepared.originalBytes - prepared.bytes);
        if (saved > 100 * 1024) {
          toast("info", `图片已压缩（约省 ${(saved / 1024 / 1024).toFixed(1)} MB）`);
        }
      }
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "插入图片失败");
    }
  }, []);
  insertImageRef.current = insertImage;

  /* ---------- 页面设置 / 色卡 / 标题 ---------- */
  const updatePageSettings = useCallback(
    (patch: Partial<PageSettings>) => {
      const next = normalizePageSettings({
        ...pageRef.current,
        ...patch,
        margin: patch.margin
          ? { ...patch.margin }
          : { ...pageRef.current.margin },
      });
      pageRef.current = next;
      setPage(next);
      markDirty();
    },
    [markDirty],
  );

  const updatePalette = useCallback(
    (next: string[]) => {
      paletteRef.current = [...next];
      setPalette([...next]);
      markDirty();
    },
    [markDirty],
  );

  const setTitle = useCallback(
    (next: string) => {
      titleRef.current = next;
      setTitleState(next);
      markDirty();
    },
    [markDirty],
  );

  actionsRef.current = {
    saveNow,
    saveAs,
    print: doPrint,
    openFind: () => setFindOpen(true),
  };

  /**
   * 全局快捷键。
   *
   * 旧版把 Ctrl+S/P/F 挂在 ProseMirror 的 handleKeyDown 上，焦点在标题输入框、
   * 工具栏或查找框时**全部失效**。编辑器是整页应用，快捷键应当按窗口监听。
   * Ctrl+K 通过事件通知格式工具栏打开链接浮层（工具栏自己订阅）。
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.isComposing) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        if (e.repeat) return;
        if (e.shiftKey) void actionsRef.current.saveAs();
        else void actionsRef.current.saveNow();
        return;
      }
      if (key === "p") {
        e.preventDefault();
        actionsRef.current.print();
        return;
      }
      if (key === "f") {
        e.preventDefault();
        actionsRef.current.openFind();
        return;
      }
      if (key === "k") {
        e.preventDefault();
        window.dispatchEvent(new Event("we:open-link"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** 有需要保护的内容：编辑过，或新建/导入后还没落到文件里 */
  const hasWork = useCallback(() => {
    if (dirtyRef.current) return true;
    return !isFileBacked(refRef.current) && Boolean(editorRef.current?.getText().trim());
  }, []);

  /* ---------- 离开 ---------- */
  const goHome = useCallback(async () => {
    // 先停掉自动保存：否则"放弃修改"后，未触发的定时器仍会把内容写回文件/草稿
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!hasWork()) {
      navigate({ page: "home" });
      return;
    }
    const choice = await openConfirm3({
      title: "有未保存的修改",
      description: "是否在离开前保存更改？",
    });
    if (choice === "cancel") return;
    if (choice === "save") {
      const target = refRef.current;
      const ok = isFileBacked(target) ? await persistRef.current(true) : await saveAs();
      if (!ok) return;
      navigate({ page: "home" });
      return;
    }
    const key = refRef.current ? refKey(refRef.current) : unsavedKey;
    // 先清 dirty：否则卸载兜底会把刚删掉的草稿又写回去
    dirtyRef.current = false;
    setDirty(false);
    await deleteDraft(key);
    navigate({ page: "home" });
  }, [hasWork, saveAs, unsavedKey]);

  /* ---------- beforeunload + 卸载兜底 ---------- */
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasWork()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasWork]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (!loadedRef.current || !dirtyRef.current) return;
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
    page,
    palette,
    dirty,
    saving,
    saveError,
    savedAt,
    fileBacked: isFileBacked(ref),
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
