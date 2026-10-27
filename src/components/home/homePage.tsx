import { useEffect, useMemo, useState } from "react";
import {
  FileText,
  FolderOpen,
  Import,
  Moon,
  Plus,
  Search,
  Sun,
  Trash2,
} from "lucide-react";
import { useRecents } from "../../hooks/useRecents";
import { useTheme } from "../../hooks/useTheme";
import { navigate } from "../../lib/router";
import { fileService } from "../../lib/storage";
import { createSowd, parseSowd, stripExt } from "../../lib/sowd";
import { importDocx } from "../../lib/docx";
import { removeRecent } from "../../lib/db";
import type { DocRef } from "../../lib/types";
import { relativeTime } from "../../lib/format";
import { toast } from "../ui/toast";
import { Button } from "../ui/button";

async function openAndGo(docxOnly: boolean) {
  const opened = await fileService.open(docxOnly);
  if (!opened) return;
  if (opened.kind === "docx") {
    toast("info", "正在转换 Word 文档…");
    try {
      const imported = await importDocx(opened.bytes!);
      if (imported.warnings.length) toast("warning", imported.warnings[0]);
      const doc = createSowd(stripExt(opened.ref.name));
      doc.content = imported.content;
      navigate({
        page: "editor",
        session: { ref: null, importedFromDocx: true, sowd: doc },
      });
    } catch {
      toast("error", "该 .docx 文件无法解析");
    }
    return;
  }
  try {
    const sowd = parseSowd(opened.text);
    navigate({ page: "editor", session: { ref: opened.ref, sowd, mtime: opened.mtime } });
  } catch (error) {
    toast("error", error instanceof Error ? error.message : "无法打开该文件");
  }
}

function openRecent(entry: {
  key: string;
  title: string;
  kind: DocRef["kind"];
  path?: string;
  handleId?: number;
}) {
  if (entry.kind === "tauri") {
    const path = entry.path!;
    const idx = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
    const name = idx >= 0 ? path.slice(idx + 1) : entry.title;
    navigate({
      page: "editor",
      session: { ref: { kind: "tauri", path, name }, needOpen: true },
    });
    return;
  }
  if (entry.kind === "web") {
    navigate({
      page: "editor",
      session: {
        ref: { kind: "web", handleId: entry.handleId!, name: entry.title },
        needOpen: true,
      },
    });
    return;
  }
  toast("warning", "该文件是通过下载保存的，请用「打开」重新选择文件");
}

export function HomePage() {
  const { recents, draftKeys, refresh, query, setQuery, filtered } = useRecents();
  const { mode, toggle } = useTheme();
  const [busy, setBusy] = useState(false);
  const hasUnsavedDraft = [...draftKeys].some((key) => key.startsWith("unsaved:"));

  const sections = useMemo(() => {
    const recent: typeof recents = [];
    const earlier: typeof recents = [];
    const week = 7 * 24 * 60 * 60 * 1000;
    filtered.forEach((item) => {
      if (Date.now() - item.openedAt < week) recent.push(item);
      else earlier.push(item);
    });
    return [
      { label: "最近 7 天", items: recent },
      { label: "更早", items: earlier },
    ].filter((section) => section.items.length > 0);
  }, [filtered]);

  const newDoc = () => navigate({ page: "editor", session: { ref: null } });

  const handleOpen = async (docxOnly: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await openAndGo(docxOnly);
    } catch (error) {
      toast("error", error instanceof Error ? error.message : "打开文件失败");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "n") {
        e.preventDefault();
        newDoc();
      } else if (key === "o") {
        e.preventDefault();
        void handleOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  return (
    <div className="flex min-h-full flex-col bg-paper">
      <header className="no-print flex h-16 shrink-0 items-center gap-4 border-b border-line px-6 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center border border-line font-serif text-[15px] font-semibold text-ink">
            S
          </span>
          <span className="font-serif text-[15px] font-semibold tracking-wide text-ink">
            Simple Word
          </span>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-1">
          <div className="relative hidden items-center sm:flex">
            <Search
              size={13}
              strokeWidth={2}
              className="pointer-events-none absolute left-2 text-ink-faint"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索"
              aria-label="搜索最近文档"
              className="h-8 w-[180px] rounded-[3px] border border-transparent bg-paper-alt pl-7 pr-2 text-[12px] text-ink placeholder:text-ink-faint hover:border-line focus:border-line-hover focus:outline-none"
            />
          </div>

          <button
            type="button"
            title={mode === "dark" ? "浅色模式" : "暗黑模式"}
            aria-label={mode === "dark" ? "浅色模式" : "暗黑模式"}
            onClick={toggle}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
          >
            {mode === "dark" ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
          </button>

          <span className="mx-1 h-5 w-px bg-line" />

          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void handleOpen(false)}>
            <FolderOpen size={14} strokeWidth={2} />
            打开
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void handleOpen(true)}>
            <Import size={14} strokeWidth={2} />
            导入
          </Button>
          <Button size="sm" variant="primary" onClick={newDoc}>
            <Plus size={14} strokeWidth={2} />
            新建文档
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[760px] flex-1 px-6 py-10 sm:px-8">
        {hasUnsavedDraft ? (
          <button
            type="button"
            onClick={newDoc}
            className="mb-8 flex w-full items-center justify-between gap-4 border-y border-line py-3 text-left hover:bg-paper-alt/60"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
              <span className="min-w-0">
                <span className="block text-[12px] font-medium text-ink">有未保存的草稿</span>
                <span className="mt-0.5 block text-[11px] text-ink-faint">
                  上次退出时的内容还留在本机，可以继续编辑
                </span>
              </span>
            </span>
            <span className="shrink-0 text-[11px] text-ink-muted">继续编辑 →</span>
          </button>
        ) : null}

        {sections.length === 0 && query.trim() ? (
          <div className="flex min-h-[calc(100vh-11.5rem)] flex-col items-center justify-center text-center">
            <p className="text-[13px] text-ink-muted">没有匹配「{query.trim()}」的文档</p>
            <Button className="mt-4" size="sm" variant="ghost" onClick={() => setQuery("")}>
              清除搜索
            </Button>
          </div>
        ) : sections.length === 0 ? (
          <div className="flex min-h-[calc(100vh-11.5rem)] items-center justify-center">
            <div className="flex -translate-y-10 items-center gap-2">
              <Button size="sm" variant="primary" onClick={newDoc}>
                <Plus size={14} strokeWidth={2} />
                新建文档
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void handleOpen(false)}>
                打开文件
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void handleOpen(true)}>
                导入 Word
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between pb-4">
              <div>
                <h1 className="font-serif text-[22px] font-semibold text-ink">文档</h1>
                <p className="mt-0.5 text-[11px] text-ink-faint">{filtered.length} 篇</p>
              </div>
            </div>

            {sections.map((section) => (
              <section key={section.label} className="mt-7 first:mt-0">
                <h2 className="mb-2 text-[10px] tracking-[0.14em] text-ink-faint">
                  {section.label}
                </h2>
                <div className="border-t border-line">
                  {section.items.map((item) => {
                    const hasDraft = draftKeys.has(item.key);
                    return (
                      <div
                        key={item.key}
                        className="group flex items-center gap-3 border-b border-line"
                      >
                        <button
                          type="button"
                          onClick={() => openRecent(item)}
                          className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left"
                        >
                          <FileText
                            size={15}
                            strokeWidth={1.8}
                            className="shrink-0 text-ink-faint"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-ink">
                              {item.title}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-ink-faint">
                              {item.kind === "tauri"
                                ? item.path
                                : item.kind === "web"
                                  ? "浏览器本地文件"
                                  : "下载的文件"}
                            </span>
                          </span>
                          {hasDraft ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-warning">
                              <span className="h-1 w-1 rounded-full bg-warning" />
                              草稿
                            </span>
                          ) : null}
                          <span className="w-16 shrink-0 text-right text-[10px] tabular-nums text-ink-faint">
                            {relativeTime(item.openedAt)}
                          </span>
                        </button>
                        <button
                          type="button"
                          title="从列表中移除"
                          aria-label={`从列表中移除 ${item.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void removeRecent(item.key).then(refresh);
                          }}
                          className="mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] text-ink-faint opacity-0 hover:bg-black/5 hover:text-error focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-white/5"
                        >
                          <Trash2 size={13} strokeWidth={2} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </main>

      <footer className="no-print flex h-10 shrink-0 items-center justify-between border-t border-line px-6 text-[10px] text-ink-faint sm:px-8">
        <span>Simple Office</span>
        <span className="hidden sm:inline">Ctrl+N 新建 · Ctrl+O 打开</span>
      </footer>
    </div>
  );
}
