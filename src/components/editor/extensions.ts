import { Extension, type Range, type AnyExtension } from "@tiptap/core";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
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
import { SlashList, type SlashListRef } from "./slashMenu";
import { safeHref } from "../../lib/sanitize";

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
            // 前缀命中优先。输入「表」时，"无序列表/有序列表"的标题里也含"表"，
            // 只按 includes 过滤仍会让键盘 Enter 选中"无序列表"；用户想要的是"表格"。
            const startsWith = items.filter((item) => item.title.toLowerCase().startsWith(q));
            if (startsWith.length) return startsWith;
            const byTitle = items.filter((item) => item.title.toLowerCase().includes(q));
            if (byTitle.length) return byTitle;
            return items.filter((item) => (item.description ?? "").toLowerCase().includes(q));
          },
          command: ({ editor: e, range, props }) => {
            props.command({ editor: e, range });
          },
          render: () => {
            let renderer: ReactRenderer | null = null;
            let popup: HTMLElement | null = null;
            let latest: SuggestionProps<SlashItem> | null = null;

            // 滚动 / 改窗口大小后重新贴住光标（旧版弹出后就与光标脱节）
            const position = () => {
              const rect = latest?.clientRect?.();
              if (!rect || !popup) return;
              const width = popup.offsetWidth || 280;
              const height = popup.offsetHeight || 320;
              const left = Math.min(
                Math.max(8, rect.left),
                Math.max(8, window.innerWidth - width - 8),
              );
              const below = rect.bottom + 6;
              const top =
                below + height > window.innerHeight - 8
                  ? Math.max(8, rect.top - height - 6)
                  : below;
              popup.style.left = `${left}px`;
              popup.style.top = `${top}px`;
            };

            const onMove = () => position();
            window.addEventListener("scroll", onMove, true);
            window.addEventListener("resize", onMove);

            return {
              onStart: (props) => {
                latest = props;
                renderer = new ReactRenderer(SlashList, {
                  props,
                  editor: props.editor,
                });
                // ⚠️ 不能在这里读 renderer.ref：React 的 ref 回调是异步落下的，
                // 此时通常还是 null。旧版把 null 存进 component，导致点击能插入、
                // 键盘 Enter 却永远是换行。改为在 onKeyDown 时现读。
                popup = document.createElement("div");
                popup.className = "sw-slash-popup";
                popup.style.position = "fixed";
                popup.style.zIndex = "999";
                popup.appendChild(renderer.element);
                (document.getElementById("overlay-root") ?? document.body).appendChild(popup);
                position();
              },
              onUpdate: (props) => {
                latest = props;
                renderer?.updateProps(props);
                position();
              },
              onKeyDown: (props) => {
                const list = renderer?.ref as SlashListRef | null;
                return list?.onKeyDown(props) ?? false;
              },
              onExit: () => {
                window.removeEventListener("scroll", onMove, true);
                window.removeEventListener("resize", onMove);
                renderer?.destroy();
                popup?.remove();
                renderer = null;
                popup = null;
                latest = null;
              },
            };
          },
        }),
      ];
    },
  });
}

/**
 * 带宽高的图片扩展。
 *
 * 旧版 `setImage({width,height})` 传了也没用（默认 Image 只有 src/alt/title），
 * 所以 docx 导出永远按 300×200 拉伸。这里把宽高真正写进节点与 HTML。
 * `inline: true` 让图片可以待在段落里（Word 的默认行为），也让旧 .sowd
 * 的 block 图片经 `migrateBlockImages()` 迁移后有合法结构。
 */
const SizedImage = Image.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      width: {
        default: null,
        parseHTML: (element) => {
          const n = Number(element.getAttribute("width"));
          return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
        },
        renderHTML: (attributes) =>
          attributes.width ? { width: Math.round(Number(attributes.width)) } : {},
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const n = Number(element.getAttribute("height"));
          return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
        },
        renderHTML: (attributes) =>
          attributes.height ? { height: Math.round(Number(attributes.height)) } : {},
      },
    };
  },
});

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
        // 输入/粘贴的链接也走白名单，不再只依赖工具栏那一个入口
        isAllowedUri: (url: string) => Boolean(safeHref(url)),
        validate: (url: string) => Boolean(safeHref(url)),
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
    SizedImage.configure({ inline: true, allowBase64: true }),
    TextStyle,
    Color,
    CharacterCount,
    slash,
  ];
}
