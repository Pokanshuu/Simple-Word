import { useMemo, useState } from "react";
import {
  AlertTriangle,
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
import { parseSowd, stripExt } from "../../lib/sowd";
import { importDocx } from "../../lib/docx";
import { removeRecent } from "../../lib/db";
import type { DocRef } from "../../lib/types";
import { relativeTime } from "../../lib/format";
import { toast } from "../ui/toast";
import { Badge, Separator } from "../ui/misc";
import { Button } from "../ui/button";
import { cn } from "../../lib/cn";

async function openAndGo(docxOnly: boolean) {
  const opened = await fileService.open(docxOnly);
  if (!opened) return;
  if (opened.kind === "docx") {
    toast("info", "正在转换 Word 文档…");
    try {
      const content = await importDocx(opened.bytes!);
      navigate({
        page: "editor",
        session: {
          ref: null,
          importedFromDocx: true,
          sowd: {
            meta: {
              format: "sowd",
              version: 1,
              title: stripExt(opened.ref.name),
              createdAt: Date.now(),
              updatedAt: Date.now(),
              app: { name: "simple-word", version: "0.1.0" },
            },
            settings: {
              page: {
                size: "A4",
                orientation: "portrait",
                margin: { top: 72, right: 72, bottom: 72, left: 72 },
              },
            },
            content,
            styles: { palette: [] },
          },
        },
      });
    } catch {
      toast("error", "该 .docx 文件无法解析");
    }
    return;
  }
  try {
    const sowd = parseSowd(opened.text);
    navigate({ page: "editor", session: { ref: opened.ref, sowd, mtime: opened.mtime } });
  } catch (err) {
    toast("error", err instanceof Error ? err.message : "无法打开该文件");
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
      session: {
        ref: { kind: "tauri", path, name },
        needOpen: true,
      },
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

  const sections = useMemo(() => {
    const today: typeof recents = [];
    const earlier: typeof recents = [];
    const day = 24 * 60 * 60 * 1000;
    filtered.forEach((r) => {
      if (Date.now() - r.openedAt < day * 7) today.push(r);
      else earlier.push(r);
    });
    return [
      { label: "最近 7 天", items: today },
      { label: "更早", items: earlier },
    ].filter((s) => s.items.length > 0);
  }, [filtered]);

  const newDoc = () => navigate({ page: "editor", session: { ref: null } });

  const handleOpen = async (docxOnly: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await openAndGo(docxOnly);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="no-print sticky top-0 z-10 flex min-h-[60px] items-center gap-3 border-b border-line bg-paper/70 px-6 py-3 backdrop-blur-lg dark:bg-[#1C1B1A]/70">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-paper-card">
            <FileText size={16} strokeWidth={2} className="text-error" />
          </span>
          <span className="font-serif text-lg font-bold text-ink">Simple Word</span>
          <Badge className="hidden sm:inline-flex">v0.1</Badge>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <div className="relative">
            <Search
              size={14}
              strokeWidth={2}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索最近文档…"
              className="h-9 w-full rounded border border-line bg-paper-card/60 pl-8 pr-3 text-sm text-ink placeholder:text-ink-faint focus:border-line-hover focus:bg-paper-card/80 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            title={mode === "dark" ? "浅色模式" : "暗黑模式"}
            onClick={toggle}
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-line bg-paper-card/60 text-ink-muted hover:border-line-hover hover:text-ink"
          >
            {mode === "dark" ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
          </button>
          <Button onClick={() => void handleOpen(false)}>
            <FolderOpen size={15} strokeWidth={2} />
            打开
          </Button>
          <Button onClick={() => void handleOpen(true)}>
            <Import size={15} strokeWidth={2} />
            导入 Word
          </Button>
          <Button
            className="border-line-hover bg-paper-card text-ink hover:bg-[#F0EBE3] dark:hover:bg-paper-card"
            onClick={newDoc}
          >
            <Plus size={15} strokeWidth={2} />
            新建文档
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        {sections.length === 0 ? (
          <div className="flex flex-col items-center pt-24 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-lg border border-line bg-paper-card">
              <FileText size={28} strokeWidth={2} className="text-error" />
            </span>
            <h1 className="mt-6 font-serif text-2xl font-bold text-ink">开始写作</h1>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-muted">
              一个寂静、克制的文档编辑器。界面退后，色彩只属于你的内容。
            </p>
            <div className="mt-6 flex items-center gap-2">
              <Button onClick={newDoc}>
                <Plus size={15} strokeWidth={2} />
                新建文档
              </Button>
              <Button onClick={() => void handleOpen(false)}>
                <FolderOpen size={15} strokeWidth={2} />
                打开文件
              </Button>
              <Button onClick={() => void handleOpen(true)}>
                <Import size={15} strokeWidth={2} />
                导入 Word 文档
              </Button>
            </div>
          </div>
        ) : (
          sections.map((section) => (
            <section key={section.label} className="mt-6 first:mt-0">
              <h2 className="px-4 pb-1 text-xs font-medium text-ink-faint">{section.label}</h2>
              <div className="rounded-md border border-line bg-paper-card/40">
                {section.items.map((item, i) => {
                  const hasDraft = draftKeys.has(item.key);
                  return (
                    <div key={item.key}>
                      {i > 0 ? <Separator className="mx-4 my-0" /> : null}
                      <button
                        type="button"
                        onClick={() => openRecent(item)}
                        className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-paper-card"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-paper-card">
                          <FileText size={16} strokeWidth={2} className="text-ink-muted" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-ink">
                              {item.title}
                            </span>
                            {hasDraft ? (
                              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-warning">
                                <AlertTriangle size={12} strokeWidth={2} />
                                草稿
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-faint">
                            <span className="truncate">
                              {item.kind === "tauri"
                                ? item.path
                                : item.kind === "web"
                                  ? "浏览器本地文件"
                                  : "下载的文件"}
                            </span>
                            <span>·</span>
                            <span className="shrink-0">{relativeTime(item.openedAt)}</span>
                          </span>
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          title="从列表中移除"
                          onClick={(e) => {
                            e.stopPropagation();
                            void removeRecent(item.key).then(refresh);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.stopPropagation();
                              void removeRecent(item.key).then(refresh);
                            }
                          }}
                          className={cn(
                            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-faint opacity-0 transition-opacity hover:bg-black/5 hover:text-error group-hover:opacity-100 dark:hover:bg-white/5",
                          )}
                        >
                          <Trash2 size={14} strokeWidth={2} />
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </main>

      <footer className="no-print flex h-10 items-center justify-center border-t border-line text-xs text-ink-faint">
        Simple Office · 寂静工作台 · 内容只属于你
      </footer>
    </div>
  );
}
