import type { Editor } from "@tiptap/react";
import {
  ArrowLeft,
  CheckCircle,
  Download,
  Image as ImageIcon,
  Moon,
  MoreHorizontal,
  PanelRight,
  Printer,
  Settings,
  Sun,
  Table as TableIcon,
  AlertTriangle,
  LoaderCircle,
} from "lucide-react";
import { Dropdown, DropdownItem, DropdownSeparator } from "../ui/dropdown";
import { ToolButton, ToolDivider, useEditorTick } from "./toolbar";
import { FormatToolbar } from "./formatToolbar";
import type { DocRef } from "../../lib/types";

export type SaveStatus = "saved" | "saving" | "dirty" | "unsaved";

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-ink-muted">
        <LoaderCircle size={13} strokeWidth={2} className="animate-spin" />
        保存中…
      </span>
    );
  }
  if (status === "dirty") {
    return (
      <span className="flex items-center gap-1 text-xs text-warning">
        <AlertTriangle size={13} strokeWidth={2} />
        未保存
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-ink-muted">
      <CheckCircle size={13} strokeWidth={2} />
      已保存
    </span>
  );
}

export function EditorTopbar({
  editor,
  title,
  setTitle,
  ref,
  saveStatus,
  palette,
  dark,
  onToggleTheme,
  onGoHome,
  onSaveNow,
  onExportDocx,
  onPrint,
  onInsertImage,
  onOpenOutline,
  onOpenPageSettings,
}: {
  editor: Editor | null;
  title: string;
  setTitle: (t: string) => void;
  ref: DocRef | null;
  saveStatus: SaveStatus;
  palette: string[];
  dark: boolean;
  onToggleTheme: () => void;
  onGoHome: () => void;
  onSaveNow: () => void;
  onExportDocx: () => void;
  onPrint: () => void;
  onInsertImage: () => void;
  onOpenOutline: () => void;
  onOpenPageSettings: () => void;
}) {
  useEditorTick(editor);

  return (
    <header className="no-print sticky top-0 z-20 flex min-h-[60px] shrink-0 items-center gap-2 border-b border-line bg-paper/70 px-4 py-2 backdrop-blur-lg dark:bg-[#1C1B1A]/70">
      {/* 左：返回 + 标题 + 保存状态 */}
      <div className="flex min-w-0 shrink items-center gap-1">
        <ToolButton icon={ArrowLeft} label="返回首页" onClick={onGoHome} />
        <div className="flex min-w-0 flex-col">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            placeholder="未命名文档"
            className="h-7 w-48 min-w-0 truncate rounded border border-transparent bg-transparent px-1.5 text-sm font-medium text-ink hover:border-line focus:border-line-hover focus:bg-paper-card focus:outline-none"
          />
          <div className="flex items-center gap-1.5 px-1.5">
            <SaveIndicator status={saveStatus} />
            {ref?.kind === "tauri" ? (
              <span className="max-w-[180px] truncate text-[11px] text-ink-faint" title={ref.path}>
                {ref.path}
              </span>
            ) : ref?.kind === "web" ? (
              <span className="text-[11px] text-ink-faint">本地文件</span>
            ) : null}
          </div>
        </div>
      </div>

      <ToolDivider />

      {/* 中：格式工具栏 */}
      <div className="flex min-w-0 flex-1 items-center overflow-x-auto">
        {editor ? <FormatToolbar editor={editor} palette={palette} /> : null}
      </div>

      {/* 右：插入 + 导出 + 更多 */}
      <div className="flex shrink-0 items-center gap-0.5">
        <ToolDivider />
        <ToolButton icon={ImageIcon} label="插入图片" onClick={onInsertImage} />
        {editor ? (
          <Dropdown
            trigger={
              <span
                onMouseDown={(e) => e.preventDefault()}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
              >
                <TableIcon size={15} strokeWidth={2} />
              </span>
            }
          >
            <DropdownItem
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            >
              插入 3×3 表格
            </DropdownItem>
            <DropdownItem
              onClick={() => editor.chain().focus().insertTable({ rows: 4, cols: 4, withHeaderRow: true }).run()}
            >
              插入 4×4 表格
            </DropdownItem>
          </Dropdown>
        ) : null}
        <ToolDivider />
        <button
          type="button"
          onClick={onExportDocx}
          title="导出为 .docx"
          className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
        >
          <Download size={14} strokeWidth={2} />
          导出
        </button>
        <ToolButton icon={Printer} label="打印 (Ctrl+P)" onClick={onPrint} />
        <Dropdown
          align="end"
          trigger={
            <span
              onMouseDown={(e) => e.preventDefault()}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
            >
              <MoreHorizontal size={15} strokeWidth={2} />
            </span>
          }
        >
          <DropdownItem
            icon={<Printer size={15} strokeWidth={2} />}
            onClick={onSaveNow}
          >
            保存
          </DropdownItem>
          <DropdownItem
            icon={<PanelRight size={15} strokeWidth={2} />}
            onClick={onOpenOutline}
          >
            显示大纲
          </DropdownItem>
          <DropdownItem
            icon={<Settings size={15} strokeWidth={2} />}
            onClick={onOpenPageSettings}
          >
            页面设置
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
