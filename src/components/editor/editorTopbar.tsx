import type { Editor } from "@tiptap/react";
import {
  ArrowLeft,
  Download,
  FileDown,
  Image as ImageIcon,
  Moon,
  MoreHorizontal,
  PanelRight,
  Printer,
  Save,
  Search,
  Settings,
  Sun,
  Table as TableIcon,
} from "lucide-react";
import { Dropdown, DropdownItem, DropdownSeparator } from "../ui/dropdown";
import { ToolButton, ToolDivider } from "./toolbar";
import { FormatToolbar } from "./formatToolbar";
import type { DocRef } from "../../lib/types";
import { cn } from "../../lib/cn";

export type SaveStatus = "saved" | "saving" | "dirty" | "unsaved" | "error";

const SAVE_META: Record<SaveStatus, { text: string; dot: string; title: string }> = {
  saved: { text: "已保存", dot: "bg-ink-faint", title: "已保存到文件" },
  saving: { text: "保存中", dot: "bg-ink-faint animate-pulse", title: "正在保存" },
  dirty: { text: "未保存", dot: "bg-warning", title: "有未保存的修改" },
  unsaved: { text: "未保存到文件", dot: "bg-ink-faint", title: "尚未保存为 .sowd 文件" },
  error: { text: "保存失败", dot: "bg-error", title: "保存失败，请检查文件权限" },
};

function SaveIndicator({ status, onSave }: { status: SaveStatus; onSave: () => void }) {
  const meta = SAVE_META[status];
  return (
    <button
      type="button"
      onClick={onSave}
      title={`${meta.title} · 点击保存（Ctrl+S）`}
      className="flex items-center gap-1.5 rounded-[3px] px-1 py-0.5 text-[11px] text-ink-muted hover:text-ink"
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
      <span className="truncate">{meta.text}</span>
    </button>
  );
}

export function EditorTopbar({
  editor,
  title,
  setTitle,
  ref,
  saveStatus,
  savedAt,
  palette,
  dark,
  outlineOpen,
  onToggleTheme,
  onGoHome,
  onSaveNow,
  onSaveAs,
  onExportDocx,
  onPrint,
  onInsertImage,
  onInsertTable,
  onOpenFind,
  onOpenOutline,
  onOpenPageSettings,
  onWarn,
}: {
  editor: Editor | null;
  title: string;
  setTitle: (t: string) => void;
  ref: DocRef | null;
  saveStatus: SaveStatus;
  savedAt: number | null;
  palette: string[];
  dark: boolean;
  outlineOpen: boolean;
  onToggleTheme: () => void;
  onGoHome: () => void;
  onSaveNow: () => void;
  onSaveAs: () => void;
  onExportDocx: () => void;
  onPrint: () => void;
  onInsertImage: () => void;
  onInsertTable: (rows: number, cols: number) => void;
  onOpenFind: () => void;
  onOpenOutline: () => void;
  onOpenPageSettings: () => void;
  onWarn: (message: string) => void;
}) {
  const fileHint =
    ref?.kind === "tauri"
      ? ref.path
      : ref?.kind === "web"
        ? "浏览器本地文件"
        : savedAt
          ? `上次保存 ${new Date(savedAt).toLocaleTimeString("zh-CN")}`
          : "尚未保存到文件";

  return (
    <header className="no-print flex h-14 shrink-0 items-center gap-1 border-b border-line bg-paper px-2">
      <ToolButton icon={ArrowLeft} label="返回首页" onClick={onGoHome} />

      <div className="flex min-w-0 max-w-[248px] shrink items-center gap-1 border-l border-line pl-1">
        <div className="flex min-w-0 flex-col">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            placeholder="未命名文档"
            aria-label="文档标题"
            title={fileHint}
            className="h-6 w-[150px] min-w-0 truncate rounded-[3px] border border-transparent bg-transparent px-1 text-[13px] font-medium text-ink hover:border-line focus:border-line-hover focus:bg-paper-alt focus:outline-none sm:w-[190px]"
          />
          <div className="flex items-center gap-1 px-1">
            <SaveIndicator status={saveStatus} onSave={onSaveNow} />
          </div>
        </div>
      </div>

      <ToolDivider />

      <div className="flex min-w-0 flex-1 items-center px-1">
        {editor ? (
          <FormatToolbar
            editor={editor}
            palette={palette}
            onWarn={onWarn}
          />
        ) : null}
      </div>

      <ToolDivider />

      <div className="flex shrink-0 items-center gap-0.5">
        <ToolButton icon={ImageIcon} label="插入图片" onClick={onInsertImage} />
        <Dropdown
          align="end"
          trigger={
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
              title="更多"
              aria-label="更多菜单"
              aria-haspopup="menu"
            >
              <MoreHorizontal size={16} strokeWidth={2} />
            </button>
          }
        >
          <DropdownItem icon={<Save size={15} strokeWidth={2} />} onClick={onSaveNow} shortcut="Ctrl+S">
            保存
          </DropdownItem>
          <DropdownItem
            icon={<FileDown size={15} strokeWidth={2} />}
            onClick={onSaveAs}
            shortcut="Ctrl+Shift+S"
          >
            另存为…
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem icon={<TableIcon size={15} strokeWidth={2} />} onClick={() => onInsertTable(3, 3)}>
            插入表格 3×3
          </DropdownItem>
          <DropdownItem icon={<TableIcon size={15} strokeWidth={2} />} onClick={() => onInsertTable(4, 4)}>
            插入表格 4×4
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem icon={<Search size={15} strokeWidth={2} />} onClick={onOpenFind} shortcut="Ctrl+F">
            查找替换
          </DropdownItem>
          <DropdownItem icon={<PanelRight size={15} strokeWidth={2} />} onClick={onOpenOutline}>
            {outlineOpen ? "隐藏大纲" : "显示大纲"}
          </DropdownItem>
          <DropdownItem icon={<Settings size={15} strokeWidth={2} />} onClick={onOpenPageSettings}>
            页面设置
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem icon={<Download size={15} strokeWidth={2} />} onClick={onExportDocx}>
            导出 Word (.docx)
          </DropdownItem>
          <DropdownItem icon={<Printer size={15} strokeWidth={2} />} onClick={onPrint} shortcut="Ctrl+P">
            打印 / PDF
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem
            icon={dark ? <Sun size={15} strokeWidth={2} /> : <Moon size={15} strokeWidth={2} />}
            onClick={onToggleTheme}
          >
            {dark ? "浅色模式" : "暗黑模式"}
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}
