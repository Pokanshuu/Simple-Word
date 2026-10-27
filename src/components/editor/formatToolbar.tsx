import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Eraser,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { ToolButton, ToolDivider, ToolGroup } from "./toolbar";
import { ColorDropdown, ColorTrigger, HeadingSelect } from "./color";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function currentColor(editor: Editor | null): string | undefined {
  return editor?.getAttributes("textStyle").color as string | undefined;
}

export function UndoRedoGroup({ editor }: { editor: Editor }) {
  return (
    <ToolGroup>
      <ToolButton
        icon={Undo2}
        label="撤销 (Ctrl+Z)"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolButton
        icon={Redo2}
        label="重做 (Ctrl+Y)"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </ToolGroup>
  );
}

export function MarkGroup({ editor }: { editor: Editor }) {
  return (
    <ToolGroup>
      <ToolButton
        icon={Bold}
        label="加粗 (Ctrl+B)"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolButton
        icon={Italic}
        label="斜体 (Ctrl+I)"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolButton
        icon={Underline}
        label="下划线 (Ctrl+U)"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolButton
        icon={Strikethrough}
        label="删除线"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
    </ToolGroup>
  );
}

export function AlignGroup({ editor }: { editor: Editor }) {
  const align = (a: string) => () => editor.chain().focus().setTextAlign(a).run();
  return (
    <ToolGroup>
      <ToolButton
        icon={AlignLeft}
        label="左对齐"
        active={editor.isActive({ textAlign: "left" })}
        onClick={align("left")}
      />
      <ToolButton
        icon={AlignCenter}
        label="居中"
        active={editor.isActive({ textAlign: "center" })}
        onClick={align("center")}
      />
      <ToolButton
        icon={AlignRight}
        label="右对齐"
        active={editor.isActive({ textAlign: "right" })}
        onClick={align("right")}
      />
      <ToolButton
        icon={AlignJustify}
        label="两端对齐"
        active={editor.isActive({ textAlign: "justify" })}
        onClick={align("justify")}
      />
    </ToolGroup>
  );
}

export function ListGroup({ editor }: { editor: Editor }) {
  return (
    <ToolGroup>
      <ToolButton
        icon={List}
        label="无序列表"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolButton
        icon={ListOrdered}
        label="有序列表"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolButton
        icon={ListChecks}
        label="任务清单"
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      />
    </ToolGroup>
  );
}

export function BlockGroup({ editor }: { editor: Editor }) {
  return (
    <ToolGroup>
      <ToolButton
        icon={Quote}
        label="引用"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolButton
        icon={Code}
        label="代码块"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      />
      <ToolButton
        icon={Minus}
        label="分割线"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />
    </ToolGroup>
  );
}

function LinkPopover({
  editor,
  anchor,
  onClose,
}: {
  editor: Editor;
  anchor: HTMLElement;
  onClose: () => void;
}) {
  const existing = (editor.getAttributes("link").href as string | undefined) ?? "";
  const [url, setUrl] = useState(existing);
  const inputRef = useRef<HTMLInputElement>(null);
  const rect = anchor.getBoundingClientRect();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const apply = () => {
    const value = url.trim();
    if (!editor.isActive("link")) {
      if (value) editor.chain().focus().extendMarkRange("link").setLink({ href: value }).run();
    } else if (value) {
      editor.chain().focus().extendMarkRange("link").updateAttributes("link", { href: value }).run();
    } else {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    }
    onClose();
  };

  const left = Math.min(rect.left, window.innerWidth - 340);

  return createPortal(
    <div
      className="fixed z-[120] flex w-[330px] items-center gap-2 rounded-md border border-line bg-paper/70 p-2 shadow-none ring-1 ring-black/5 backdrop-blur-lg dark:bg-paper/80"
      style={{ left, top: rect.bottom + 6 }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Input
        ref={inputRef}
        value={url}
        placeholder="输入链接地址 (https://…)"
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply();
        }}
        className="h-8"
      />
      <Button size="sm" onClick={apply}>
        确定
      </Button>
    </div>,
    document.getElementById("overlay-root") ?? document.body,
  );
}

export function FormatToolbar({
  editor,
  palette,
  compact,
}: {
  editor: Editor;
  palette: string[];
  compact?: boolean;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const linkBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!linkOpen) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (!(e.target instanceof Node)) return;
      if (linkBtnRef.current?.contains(e.target)) return;
      const overlay = document.getElementById("overlay-root");
      if (overlay?.contains(e.target)) return;
      setLinkOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [linkOpen]);

  return (
    <>
      {!compact ? (
        <>
          <UndoRedoGroup editor={editor} />
          <ToolDivider />
          <HeadingSelect editor={editor} />
          <ToolDivider />
        </>
      ) : null}
      <MarkGroup editor={editor} />
      <ToolDivider />
      <ColorDropdown
        palette={palette}
        current={currentColor(editor)}
        onPick={(c) => editor.chain().focus().setColor(c).run()}
      >
        <ColorTrigger color={currentColor(editor)} />
      </ColorDropdown>
      {!compact ? (
        <>
          <ToolDivider />
          <AlignGroup editor={editor} />
          <ToolDivider />
          <ListGroup editor={editor} />
          <ToolDivider />
          <BlockGroup editor={editor} />
        </>
      ) : null}
      <ToolDivider />
      <button
        ref={linkBtnRef}
        type="button"
        title="链接"
        aria-label="链接"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (editor.isActive("link")) {
            editor.chain().focus().unsetLink().run();
          } else {
            setLinkOpen(true);
          }
        }}
        className={
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5 dark:hover:text-[#E3DFD8]" +
          (editor.isActive("link") ? " bg-black/5 text-ink dark:bg-white/10" : "")
        }
      >
        <Link2 size={15} strokeWidth={2} />
      </button>
      <ToolButton
        icon={Eraser}
        label="清除格式"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      />
      {linkOpen && linkBtnRef.current ? (
        <LinkPopover editor={editor} anchor={linkBtnRef.current} onClose={() => setLinkOpen(false)} />
      ) : null}
    </>
  );
}
