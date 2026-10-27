import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Rows3, Table as TableIcon, Trash2, ImagePlus, ImageOff } from "lucide-react";
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
        icon={TableIcon}
        label="左侧插入列"
        onClick={() => editor.chain().focus().addColumnBefore().run()}
      />
      <ToolButton
        icon={TableIcon}
        label="右侧插入列"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
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
}: {
  editor: Editor;
  palette: string[];
  onReplaceImage: () => void;
}) {
  return (
    <BubbleMenu
      editor={editor}
      appendTo={() => document.getElementById("overlay-root") ?? document.body}
      options={{ placement: "top", offset: 8 }}
      shouldShow={({ editor: e }) => {
        if (e.isActive("table") || e.isActive("image")) return true;
        const { from, to } = e.state.selection;
        return from !== to && !e.isActive("codeBlock");
      }}
      updateDelay={0}
    >
      <div className="flex items-center gap-0.5 rounded-md border border-line bg-paper/60 p-1 shadow-none ring-1 ring-black/5 backdrop-blur-lg dark:bg-paper/70">
        {editor.isActive("table") ? (
          <TableOps editor={editor} />
        ) : editor.isActive("image") ? (
          <ImageOps editor={editor} onReplace={onReplaceImage} />
        ) : (
          <FormatToolbar editor={editor} palette={palette} compact />
        )}
      </div>
    </BubbleMenu>
  );
}
