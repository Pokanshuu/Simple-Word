import { Extension, type Range, type AnyExtension } from "@tiptap/core";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";
import { ReactRenderer, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextAlign } from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Image } from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { CharacterCount } from "@tiptap/extensions";
import {
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Table as TableIcon,
  type LucideIcon,
} from "lucide-react";
import { SlashList } from "./slashMenu";

export interface SlashItem {
  title: string;
  description?: string;
  icon: LucideIcon;
  command: (props: { editor: Editor; range: Range }) => void;
}

export function createSlashItems(onInsertImage: () => void): SlashItem[] {
  return [
    {
      title: "正文",
      description: "普通段落",
      icon: Pilcrow,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setParagraph().run();
      },
    },
    {
      title: "一级标题",
      description: "大标题",
      icon: Heading1,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
      },
    },
    {
      title: "二级标题",
      description: "中标题",
      icon: Heading2,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
      },
    },
    {
      title: "三级标题",
      description: "小标题",
      icon: Heading3,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
      },
    },
    {
      title: "无序列表",
      description: "项目符号列表",
      icon: List,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: "有序列表",
      description: "编号列表",
      icon: ListOrdered,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: "任务清单",
      description: "带复选框的待办",
      icon: ListChecks,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: "引用",
      description: "引用一段文字",
      icon: Quote,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      title: "代码块",
      description: "等宽字体代码",
      icon: Code,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      title: "分割线",
      description: "视觉分隔",
      icon: Minus,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      title: "表格",
      description: "插入 3×3 表格",
      icon: TableIcon,
      command: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run();
      },
    },
    {
      title: "图片",
      description: "从本地插入图片",
      icon: ImageIcon,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).run();
        onInsertImage();
      },
    },
  ];
}

function createSlashExtension(items: SlashItem[]) {
  return Extension.create({
    name: "slashCommand",
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [
        Suggestion<SlashItem>({
          editor,
          char: "/",
          allowSpaces: false,
          startOfLine: false,
          items: ({ query }) => {
            const q = query.toLowerCase();
            if (!q) return items;
            return items.filter(
              (item) =>
                item.title.toLowerCase().includes(q) ||
                (item.description ?? "").toLowerCase().includes(q),
            );
          },
          command: ({ editor: e, range, props }) => {
            props.command({ editor: e, range });
          },
          render: () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let component: { onKeyDown: (p: SuggestionKeyDownProps) => boolean } | null = null;
            let renderer: ReactRenderer | null = null;
            let popup: HTMLElement | null = null;

            const position = (el: HTMLElement, props: SuggestionProps<SlashItem>) => {
              const rect = props.clientRect?.();
              if (!rect || !el) return;
              el.style.left = `${rect.left}px`;
              const w = el.offsetWidth || 300;
              if (rect.left + w > window.innerWidth - 8) {
                el.style.left = `${Math.max(8, window.innerWidth - w - 8)}px`;
              }
              el.style.top = `${rect.bottom + 6}px`;
            };

            return {
              onStart: (props) => {
                renderer = new ReactRenderer(SlashList, {
                  props,
                  editor: props.editor,
                });
                component = renderer.ref as typeof component;
                popup = document.createElement("div");
                popup.style.position = "fixed";
                popup.style.zIndex = "999";
                popup.appendChild(renderer.element);
                (document.getElementById("overlay-root") ?? document.body).appendChild(popup);
                position(popup, props);
              },
              onUpdate: (props) => {
                renderer?.updateProps(props);
                if (popup) position(popup, props);
              },
              onKeyDown: (props) => component?.onKeyDown(props) ?? false,
              onExit: () => {
                renderer?.destroy();
                popup?.remove();
                renderer = null;
                popup = null;
                component = null;
              },
            };
          },
        }),
      ];
    },
  });
}

export function buildExtensions(opts: {
  placeholder?: string;
  onInsertImage: () => void;
}): AnyExtension[] {
  const slash = createSlashExtension(createSlashItems(opts.onInsertImage));
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      },
      codeBlock: {},
    }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Placeholder.configure({
      placeholder: opts.placeholder ?? "输入内容，或按 / 插入更多元素",
    }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({ nested: true }),
    Image.configure({ inline: false }),
    TextStyle,
    Color,
    CharacterCount,
    slash,
  ];
}
