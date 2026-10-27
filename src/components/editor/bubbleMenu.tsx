import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  Columns3,
  ImageOff,
  ImagePlus,
  Rows3,
  TableCellsMerge,
  TableCellsSplit,
  Trash2,
} from "lucide-react";
import { FormatToolbar } from "./formatToolbar";
import { ToolButton, ToolDivider } from "./toolbar";

function TableOps({ editor }: { editor: Editor }) {
  return (
    <>
      <ToolButton
        icon={Rows3}
        label="上方插入行"
        onClick={() => editor.chain().focus().addRowBefore().run()}
      />
      <ToolButton
        icon={Rows3}
        label="下方插入行"
        onClick={() => editor.chain().focus().addRowAfter().run()}
      />
      <ToolButton
        icon={Columns3}
        label="左侧插入列"
        onClick={() => editor.chain().focus().addColumnBefore().run()}
      />
      <ToolButton
        icon={Columns3}
        label="右侧插入列"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      />
      <ToolDivider />
      <ToolButton
        icon={TableCellsMerge}
        label="合并单元格"
        onClick={() => editor.chain().focus().mergeCells().run()}
      />
      <ToolButton
        icon={TableCellsSplit}
        label="拆分单元格"
        onClick={() => editor.chain().focus().splitCell().run()}
      />
      <ToolDivider />
      <ToolButton
        icon={Trash2}
        label="删除表格"
        onClick={() => editor.chain().focus().deleteTable().run()}
      />
    </>
  );
}

function ImageOps({ editor, onReplace }: { editor: Editor; onReplace: () => void }) {
  return (
    <>
      <ToolButton icon={ImagePlus} label="替换图片" onClick={onReplace} />
      <ToolButton
        icon={ImageOff}
        label="删除图片"
        onClick={() => editor.chain().focus().deleteSelection().run()}
      />
    </>
  );
}

export function EditorBubbleMenu({
  editor,
  palette,
  onReplaceImage,
  onWarn,
}: {
  editor: Editor;
  palette: string[];
  onReplaceImage: () => void;
  onWarn: (message: string) => void;
}) {
  const ctx = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      table: e.isActive("table"),
      image: e.isActive("image"),
    }),
  });

  return (
    <BubbleMenu
      editor={editor}
      appendTo={() => document.getElementById("overlay-root") ?? document.body}
      options={{ placement: "top", offset: 8 }}
      updateDelay={0}
      shouldShow={({ editor: e }) => {
        if (e.isActive("table") || e.isActive("image")) return true;
        const { from, to } = e.state.selection;
        return from !== to && !e.isActive("codeBlock");
      }}
    >
      <div
        className="flex items-center gap-0.5 rounded-[4px] border border-line bg-paper p-1"
        style={{ boxShadow: "0 8px 26px rgba(35, 30, 24, 0.10)" }}
        role="toolbar"
        aria-label="选词菜单"
      >
        {ctx.table ? (
          <TableOps editor={editor} />
        ) : ctx.image ? (
          <ImageOps editor={editor} onReplace={onReplaceImage} />
        ) : (
          <FormatToolbar
            editor={editor}
            palette={palette}
            compact
            shortcut={false}
            onWarn={onWarn}
          />
        )}
      </div>
    </BubbleMenu>
  );
}
