import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useEditorState, type Editor } from "@tiptap/react";
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
  MoreHorizontal,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { safeHref } from "../../lib/sanitize";
import { ColorDropdown, ColorTrigger, HeadingSelect } from "./color";
import { ToolButton, ToolDivider, ToolGroup } from "./toolbar";

/** 「更多」按钮预留宽度（与 h-7 w-7 一致） */
const MORE_BTN_WIDTH = 30;

const ALIGNMENTS = ["left", "center", "right", "justify"] as const;
type Align = (typeof ALIGNMENTS)[number] | "";

/* ---------------- 订阅格式激活态 ---------------- */
/**
 * TipTap 3 的 useEditor 默认**不在事务时重渲染**。旧版靠顶层 useEditorTick
 * 把整个顶栏刷一遍，既浪费又会让气泡菜单里的上下文停在打开那一刻。
 * 这里用 useEditorState 只订阅真正需要的字段。
 */
export function useFormatState(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      heading: e.isActive("heading") ? Number(e.getAttributes("heading").level ?? 1) : 0,
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      color: (e.getAttributes("textStyle").color as string | undefined) ?? undefined,
      align: (ALIGNMENTS.find((a) => e.isActive({ textAlign: a })) ?? "") as Align,
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      taskList: e.isActive("taskList"),
      blockquote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      link: e.isActive("link"),
    }),
  });
}

export type FormatState = ReturnType<typeof useFormatState>;

export function InlineMarkButtons({ editor, st }: { editor: Editor; st: FormatState }) {
  return (
    <ToolGroup>
      <ToolButton
        icon={Bold}
        label="加粗 (Ctrl+B)"
        active={st.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolButton
        icon={Italic}
        label="斜体 (Ctrl+I)"
        active={st.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolButton
        icon={Underline}
        label="下划线 (Ctrl+U)"
        active={st.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolButton
        icon={Strikethrough}
        label="删除线"
        active={st.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
    </ToolGroup>
  );
}

/* ---------------- 链接浮层 ---------------- */

function LinkPopover({
  editor,
  anchor,
  onClose,
  onWarn,
}: {
  editor: Editor;
  anchor: HTMLElement;
  onClose: () => void;
  onWarn: (message: string) => void;
}) {
  const existing = String(editor.getAttributes("link").href ?? "");
  const [url, setUrl] = useState(existing);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const rect = anchor.getBoundingClientRect();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return;
      if (boxRef.current?.contains(e.target) || anchor.contains(e.target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, [anchor, onClose]);

  const apply = () => {
    const value = url.trim();
    if (!value) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      onClose();
      return;
    }
    const safe = safeHref(value);
    if (!safe) {
      onWarn("链接协议不支持：仅允许 http/https/mailto/tel 或站内路径");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: safe }).run();
    onClose();
  };

  const width = 330;
  const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
  const top =
    rect.bottom + 6 + 52 > window.innerHeight ? Math.max(8, rect.top - 58) : rect.bottom + 6;

  return createPortal(
    <div
      ref={boxRef}
      className="fixed z-[120] flex w-[330px] items-center gap-1.5 rounded-[4px] border border-line bg-paper p-2"
      style={{ left, top, boxShadow: "0 10px 32px rgba(35, 30, 24, 0.10)" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        value={url}
        placeholder="https://… 或 /path"
        aria-label="链接地址"
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply();
        }}
        className="h-8 min-w-0 flex-1 rounded-[3px] border border-line bg-paper-alt px-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-line-hover focus:outline-none"
      />
      {existing ? (
        <button
          type="button"
          className="h-8 shrink-0 rounded-[3px] px-2 text-xs text-ink-muted hover:bg-paper-alt hover:text-ink"
          onClick={() => {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            onClose();
          }}
        >
          移除
        </button>
      ) : null}
      <button
        type="button"
        className="h-8 shrink-0 rounded-[3px] bg-ink px-3 text-xs font-medium text-paper hover:opacity-90"
        onClick={apply}
      >
        确定
      </button>
    </div>,
    document.getElementById("overlay-root") ?? document.body,
  );
}

/* ---------------- 顶栏 ---------------- */

type SectionKey =
  | "history"
  | "heading"
  | "marks"
  | "color"
  | "align"
  | "lists"
  | "blocks"
  | "link"
  | "clear";

const SECTION_ORDER: SectionKey[] = [
  "history",
  "heading",
  "marks",
  "color",
  "align",
  "lists",
  "blocks",
  "link",
  "clear",
];

/** 先收低频，再收中频；历史、段落样式、行内标记、链接始终可见 */
const COLLAPSE_ORDER: SectionKey[] = ["color", "clear", "align", "lists", "blocks"];

export function FormatToolbar({
  editor,
  palette,
  compact = false,
  shortcut = true,
  onWarn,
}: {
  editor: Editor;
  palette: string[];
  compact?: boolean;
  /** 是否订阅 Ctrl+K。顶栏与气泡各挂一份，只让顶栏响应，避免同时开两个浮层。 */
  shortcut?: boolean;
  onWarn: (message: string) => void;
}) {
  const st = useFormatState(editor);
  const [linkOpen, setLinkOpen] = useState(false);
  const linkBtnRef = useRef<HTMLButtonElement>(null);

  const barRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<SectionKey, HTMLDivElement | null>>>({});
  const widthsRef = useRef<Partial<Record<SectionKey, number>>>({});
  const [measured, setMeasured] = useState(false);
  const [hidden, setHidden] = useState<SectionKey[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const morePopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shortcut) return;
    const open = () => setLinkOpen(true);
    window.addEventListener("we:open-link", open);
    return () => window.removeEventListener("we:open-link", open);
  }, [shortcut]);

  // 首次渲染量出各组固有宽度（此时全部可见；之后折叠不再重测量）
  useLayoutEffect(() => {
    if (measured || compact) return;
    let any = false;
    for (const key of SECTION_ORDER) {
      const el = sectionRefs.current[key];
      if (el) {
        widthsRef.current[key] = el.getBoundingClientRect().width;
        any = true;
      }
    }
    if (any) setMeasured(true);
  }, [measured, compact]);

  const refit = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;
    const host = bar.parentElement ?? bar;
    const avail = host.clientWidth - MORE_BTN_WIDTH;
    if (avail <= 0) return;
    const gap = Number.parseFloat(getComputedStyle(bar).columnGap || "0") || 0;
    let chosen = COLLAPSE_ORDER.length;
    for (let n = 0; n <= COLLAPSE_ORDER.length; n += 1) {
      const cut = new Set(COLLAPSE_ORDER.slice(0, n));
      const visible = SECTION_ORDER.filter((key) => !cut.has(key));
      const width =
        visible.reduce((sum, key) => sum + (widthsRef.current[key] ?? 0), 0) +
        gap * Math.max(0, visible.length - 1) +
        (n > 0 ? MORE_BTN_WIDTH : 0);
      if (width <= avail) {
        chosen = n;
        break;
      }
    }
    const next = COLLAPSE_ORDER.slice(0, chosen);
    setHidden((prev) => (prev.join() === next.join() ? prev : next));
  }, []);

  useEffect(() => {
    if (!measured || compact) return;
    refit();
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => refit());
    ro.observe(bar);
    if (bar.parentElement) ro.observe(bar.parentElement);
    return () => ro.disconnect();
  }, [measured, compact, refit]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target instanceof Node)) return;
      if (moreBtnRef.current?.contains(e.target) || morePopRef.current?.contains(e.target)) return;
      setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const align = (value: string) => () => editor.chain().focus().setTextAlign(value).run();

  const renderSection = (key: SectionKey): ReactNode => {
    switch (key) {
      case "history":
        return (
          <ToolGroup>
            <ToolButton
              icon={Undo2}
              label="撤销 (Ctrl+Z)"
              disabled={!st.canUndo}
              onClick={() => editor.chain().focus().undo().run()}
            />
            <ToolButton
              icon={Redo2}
              label="重做 (Ctrl+Y)"
              disabled={!st.canRedo}
              onClick={() => editor.chain().focus().redo().run()}
            />
          </ToolGroup>
        );
      case "heading":
        return <HeadingSelect editor={editor} />;
      case "marks":
        return <InlineMarkButtons editor={editor} st={st} />;
      case "color":
        return (
          <ColorDropdown
            palette={palette}
            current={st.color}
            onPick={(color) => editor.chain().focus().setColor(color).run()}
          >
            <ColorTrigger color={st.color} />
          </ColorDropdown>
        );
      case "align":
        return (
          <ToolGroup>
            <ToolButton
              icon={AlignLeft}
              label="左对齐"
              active={st.align === "left"}
              onClick={align("left")}
            />
            <ToolButton
              icon={AlignCenter}
              label="居中"
              active={st.align === "center"}
              onClick={align("center")}
            />
            <ToolButton
              icon={AlignRight}
              label="右对齐"
              active={st.align === "right"}
              onClick={align("right")}
            />
            <ToolButton
              icon={AlignJustify}
              label="两端对齐"
              active={st.align === "justify"}
              onClick={align("justify")}
            />
          </ToolGroup>
        );
      case "lists":
        return (
          <ToolGroup>
            <ToolButton
              icon={List}
              label="无序列表"
              active={st.bulletList}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            />
            <ToolButton
              icon={ListOrdered}
              label="有序列表"
              active={st.orderedList}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            />
            <ToolButton
              icon={ListChecks}
              label="任务清单"
              active={st.taskList}
              onClick={() => editor.chain().focus().toggleTaskList().run()}
            />
          </ToolGroup>
        );
      case "blocks":
        return (
          <ToolGroup>
            <ToolButton
              icon={Quote}
              label="引用"
              active={st.blockquote}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            />
            <ToolButton
              icon={Code}
              label="代码块"
              active={st.codeBlock}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            />
            <ToolButton
              icon={Minus}
              label="分割线"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
            />
          </ToolGroup>
        );
      case "link":
        return (
          <button
            ref={linkBtnRef}
            type="button"
            title="链接 (Ctrl+K)"
            aria-label="链接"
            aria-pressed={st.link ? "true" : "false"}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setLinkOpen(true)}
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5",
              st.link && "bg-black/5 text-ink dark:bg-white/10 dark:text-[#E3DFD8]",
            )}
          >
            <Link2 size={15} strokeWidth={2} />
          </button>
        );
      case "clear":
        return (
          <ToolButton
            icon={Eraser}
            label="清除格式"
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          />
        );
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <InlineMarkButtons editor={editor} st={st} />
        <ToolDivider />
        <ColorDropdown
          palette={palette}
          current={st.color}
          onPick={(color) => editor.chain().focus().setColor(color).run()}
        >
          <ColorTrigger color={st.color} />
        </ColorDropdown>
        <ToolDivider />
        <button
          type="button"
          title="链接"
          aria-label="链接"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => window.dispatchEvent(new Event("we:open-link"))}
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-[3px] text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5",
            st.link && "bg-black/5 text-ink dark:bg-white/10",
          )}
        >
          <Link2 size={15} strokeWidth={2} />
        </button>
        <ToolButton
          icon={Eraser}
          label="清除格式"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        />
      </div>
    );
  }

  const moreRect = moreBtnRef.current?.getBoundingClientRect();
  const moreLeft = moreRect
    ? Math.min(Math.max(8, moreRect.right - 180), Math.max(8, window.innerWidth - 196))
    : 8;
  const moreTop = moreRect ? moreRect.bottom + 6 : 0;

  return (
    <div ref={barRef} className="flex min-w-0 items-center" role="toolbar" aria-label="格式工具栏">
      {SECTION_ORDER.map((key) =>
        hidden.includes(key) && measured && !compact ? null : (
          <div
            key={key}
            className="flex shrink-0 items-center"
            ref={(el) => {
              sectionRefs.current[key] = el;
            }}
          >
            {renderSection(key)}
            <ToolDivider />
          </div>
        ),
      )}

      {hidden.length > 0 ? (
        <button
          ref={moreBtnRef}
          type="button"
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] text-ink-muted hover:bg-black/5 hover:text-ink dark:hover:bg-white/5",
            moreOpen && "bg-black/5 text-ink dark:bg-white/10",
          )}
          aria-label="更多格式"
          title="更多格式"
          aria-expanded={moreOpen ? "true" : "false"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <MoreHorizontal size={16} strokeWidth={2} />
        </button>
      ) : null}

      {linkOpen && linkBtnRef.current ? (
        <LinkPopover
          editor={editor}
          anchor={linkBtnRef.current}
          onClose={() => setLinkOpen(false)}
          onWarn={onWarn}
        />
      ) : null}

      {moreOpen && hidden.length > 0
        ? createPortal(
            <div
              ref={morePopRef}
              className="fixed z-[120] flex w-[184px] flex-col rounded-[4px] border border-line bg-paper p-1"
              style={{ left: moreLeft, top: moreTop, boxShadow: "0 10px 32px rgba(35, 30, 24, 0.10)" }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {hidden.map((key) => (
                <div
                  key={key}
                  className="flex min-h-8 items-center rounded-[3px] px-1 hover:bg-paper-alt"
                >
                  {renderSection(key)}
                  <span className="ml-auto text-[11px] text-ink-faint">
                    {key === "color"
                      ? "颜色"
                      : key === "align"
                        ? "对齐"
                        : key === "lists"
                          ? "列表"
                          : key === "blocks"
                            ? "块"
                            : "格式"}
                  </span>
                </div>
              ))}
            </div>,
            document.getElementById("overlay-root") ?? document.body,
          )
        : null}
    </div>
  );
}
