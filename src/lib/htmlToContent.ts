/**
 * mammoth 输出的 HTML → TipTap JSONContent（.docx 导入）。
 *
 * 这份实现移植自 Simple_Blog 的 `src/lib/word-editor/html-to-doc.ts`，
 * 并把当时逐条修掉的缺陷一并带回来：
 *
 * - 空文本节点 `{type:"text",text:""}` 会让 prosemirror-model 抛错、整篇变空
 * - 空标题 `<h1></h1>` 不能再塞 `paragraph`（heading 只收内联）
 * - 表格用 `querySelectorAll("tr")` 深查会把嵌套表格的行重复拼进外层表
 * - 单元格里的直接文本节点原先被丢弃
 * - `<code>` 不落 `code` mark（行内代码丢失）
 * - `<mark>` 高亮底色被误当作文字颜色
 * - 链接 href 不消毒（`javascript:` 可混入）
 * - 嵌套列表 / 表格 / 引用中的空结构会让 schema 拒绝整篇文档
 *
 * 图片保持为**段落内联节点**（Image 扩展已配置 inline: true）。docx 导出、
 * 复制粘贴、旧 .sowd 迁移因此共用同一种结构。
 */
import type { JSONContent } from "@tiptap/react";
import { normalizeDocContent, safeColor, safeHref, safeImageSrc } from "./sanitize";

interface MarkMap {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  color?: string;
  link?: string;
}

type Mark = { type: string; attrs?: Record<string, unknown> };

function colorFromStyle(el: Element): string | undefined {
  const style = el.getAttribute("style") ?? "";
  const match = /(?:^|;)\s*color:\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\))/.exec(style);
  return match ? safeColor(match[1]) : undefined;
}

function isWhite(color?: string): boolean {
  return !!color && /^(?:#f{3,6}|rgba?\(\s*255,\s*255,\s*255(?:\s*,[^)]*)?\))$/i.test(color.replace(/\s/g, ""));
}

function px(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

function imageDims(el: Element): { width?: number; height?: number } {
  const style = el.getAttribute("style") ?? "";
  const width =
    px(el.getAttribute("width")) ??
    px(/(?:^|;)\s*width:\s*([\d.]+)px/.exec(style)?.[1] ?? null);
  const height =
    px(el.getAttribute("height")) ??
    px(/(?:^|;)\s*height:\s*([\d.]+)px/.exec(style)?.[1] ?? null);
  return { width, height };
}

function textNode(text: string, marks: Mark[]): JSONContent | null {
  if (!text) return null; // 空文本节点非法
  return marks.length ? { type: "text", text, marks } : { type: "text", text };
}

function inlineOf(node: Node, marks: MarkMap): JSONContent[] {
  const out: JSONContent[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      const markArr: Mark[] = [];
      if (marks.bold) markArr.push({ type: "bold" });
      if (marks.italic) markArr.push({ type: "italic" });
      if (marks.underline) markArr.push({ type: "underline" });
      if (marks.strike) markArr.push({ type: "strike" });
      if (marks.code) markArr.push({ type: "code" });
      if (marks.color && !isWhite(marks.color)) {
        markArr.push({ type: "textStyle", attrs: { color: marks.color } });
      }
      if (marks.link) {
        markArr.push({ type: "link", attrs: { href: marks.link, target: "_blank" } });
      }
      const textEl = textNode(text, markArr);
      if (textEl) out.push(textEl);
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as Element;
    const next: MarkMap = { ...marks };
    switch (el.tagName.toLowerCase()) {
      case "strong":
      case "b":
        next.bold = true;
        out.push(...inlineOf(el, next));
        break;
      case "em":
      case "i":
        next.italic = true;
        out.push(...inlineOf(el, next));
        break;
      case "u":
        next.underline = true;
        out.push(...inlineOf(el, next));
        break;
      case "s":
      case "strike":
      case "del":
        next.strike = true;
        out.push(...inlineOf(el, next));
        break;
      case "span": {
        const color = colorFromStyle(el);
        if (color) next.color = color;
        out.push(...inlineOf(el, next));
        break;
      }
      case "font": {
        const color = safeColor(el.getAttribute("color"));
        if (color) next.color = color;
        out.push(...inlineOf(el, next));
        break;
      }
      case "a": {
        const href = safeHref(el.getAttribute("href"));
        if (href) next.link = href;
        out.push(...inlineOf(el, next));
        break;
      }
      case "code":
        next.code = true;
        out.push(...inlineOf(el, next));
        break;
      case "img": {
        const src = safeImageSrc(el.getAttribute("src"));
        if (!src) break;
        const dims = imageDims(el);
        out.push({
          type: "image",
          attrs: {
            src,
            alt: el.getAttribute("alt") ?? "",
            ...(dims.width ? { width: dims.width } : {}),
            ...(dims.height ? { height: dims.height } : {}),
          },
        });
        break;
      }
      case "br":
        out.push({ type: "hardBreak" });
        break;
      case "mark":
        // 高亮底色不映射为文字颜色（旧版缺陷），只保留文字
        out.push(...inlineOf(el, next));
        break;
      case "sub":
      case "sup":
        out.push(...inlineOf(el, next));
        break;
      default:
        out.push(...inlineOf(el, next));
    }
  });
  return out;
}

function paragraphFrom(el: Element): JSONContent {
  const attrs: Record<string, unknown> = {};
  const align = (el.getAttribute("align") ?? "").toLowerCase();
  if (["left", "center", "right", "justify"].includes(align)) attrs.textAlign = align;
  const styleAlign = /(?:^|;)\s*text-align:\s*(left|center|right|justify)/.exec(
    el.getAttribute("style") ?? "",
  );
  if (styleAlign) attrs.textAlign = styleAlign[1];
  const content = inlineOf(el, {});
  return {
    type: "paragraph",
    attrs: Object.keys(attrs).length ? attrs : undefined,
    ...(content.length ? { content } : {}),
  };
}

function plainParagraph(text: string): JSONContent {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function convertListItem(li: Element): JSONContent {
  const parts: JSONContent[] = [];
  const nested: JSONContent[] = [];
  li.childNodes.forEach((n) => {
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as Element;
      const tag = el.tagName.toLowerCase();
      if (tag === "ul" || tag === "ol") {
        nested.push(...convertBlock(el));
      } else if (tag === "p") {
        parts.push(paragraphFrom(el));
      } else {
        const blocks = convertBlock(el);
        if (blocks.length) parts.push(...blocks);
        else {
          const inline = inlineOf(el, {});
          if (inline.length) parts.push({ type: "paragraph", content: inline });
        }
      }
    } else if (n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim()) {
      parts.push(plainParagraph(n.textContent ?? ""));
    }
  });
  if (!parts.length) parts.push({ type: "paragraph" });
  return { type: "listItem", content: [...parts, ...nested] };
}

function convertTable(table: Element): JSONContent {
  const rows: JSONContent[] = [];
  // 只取直接子行，避免嵌套表格的行被重复拼进外层表
  table
    .querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr")
    .forEach((tr) => {
      const cells: JSONContent[] = [];
      tr.querySelectorAll(":scope > th, :scope > td").forEach((cell) => {
        const isHeader = cell.tagName.toLowerCase() === "th";
        const paras: JSONContent[] = [];
        cell.childNodes.forEach((n) => {
          if (n.nodeType === Node.ELEMENT_NODE) {
            const blocks = convertBlock(n as Element);
            if (blocks.length) paras.push(...blocks);
          } else if (n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim()) {
            paras.push(plainParagraph(n.textContent ?? ""));
          }
        });
        if (!paras.length) paras.push({ type: "paragraph" });
        cells.push({ type: isHeader ? "tableHeader" : "tableCell", content: paras });
      });
      if (cells.length) rows.push({ type: "tableRow", content: cells });
    });
  return rows.length ? { type: "table", content: rows } : { type: "paragraph" };
}

function convertBlock(el: Element): JSONContent[] {
  const tag = el.tagName.toLowerCase();
  switch (tag) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const content = inlineOf(el, {});
      const heading: JSONContent = { type: "heading", attrs: { level: Number(tag[1]) } };
      if (content.length) heading.content = content; // heading 只收内联
      return [heading];
    }
    case "p":
      return [paragraphFrom(el)];
    case "ul":
    case "ol": {
      const items: JSONContent[] = [];
      el.querySelectorAll(":scope > li").forEach((li) => items.push(convertListItem(li)));
      if (!items.length) return [];
      return [{ type: tag === "ul" ? "bulletList" : "orderedList", content: items }];
    }
    case "blockquote": {
      const children: JSONContent[] = [];
      el.childNodes.forEach((n) => {
        if (n.nodeType === Node.ELEMENT_NODE) children.push(...convertBlock(n as Element));
        else if (n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim()) {
          children.push(plainParagraph(n.textContent ?? ""));
        }
      });
      return [{ type: "blockquote", content: children.length ? children : [{ type: "paragraph" }] }];
    }
    case "pre": {
      const text = (el.textContent ?? "").replace(/\n$/, "");
      const codeEl = el.querySelector("code");
      const lang = codeEl?.className?.match(/language-([\w-]+)/)?.[1] ?? "";
      const node: JSONContent = {
        type: "codeBlock",
        attrs: lang ? { language: lang } : undefined,
      };
      if (text) node.content = [{ type: "text", text }]; // 不造空文本节点
      return [node];
    }
    case "table":
      return [convertTable(el)];
    case "hr":
      return [{ type: "horizontalRule" }];
    case "img": {
      const src = safeImageSrc(el.getAttribute("src"));
      if (!src) return [];
      const dims = imageDims(el);
      return [
        {
          type: "paragraph",
          content: [
            {
              type: "image",
              attrs: {
                src,
                alt: el.getAttribute("alt") ?? "",
                ...(dims.width ? { width: dims.width } : {}),
                ...(dims.height ? { height: dims.height } : {}),
              },
            },
          ],
        },
      ];
    }
    case "figure": {
      const img = el.querySelector("img");
      const src = img ? safeImageSrc(img.getAttribute("src")) : "";
      const out: JSONContent[] = [];
      if (src && img) {
        const dims = imageDims(img);
        out.push({
          type: "paragraph",
          content: [
            {
              type: "image",
              attrs: {
                src,
                alt: img.getAttribute("alt") ?? "",
                ...(dims.width ? { width: dims.width } : {}),
                ...(dims.height ? { height: dims.height } : {}),
              },
            },
          ],
        });
      }
      const caption = el.querySelector("figcaption");
      if (caption) {
        const content = inlineOf(caption, {});
        if (content.length) {
          out.push({
            type: "paragraph",
            attrs: { textAlign: "center" },
            content,
          });
        }
      }
      return out;
    }
    case "center": {
      const content = inlineOf(el, {});
      return content.length
        ? [{ type: "paragraph", attrs: { textAlign: "center" }, content }]
        : [];
    }
    default: {
      // div / section / article 等容器：递归提取子块
      const out: JSONContent[] = [];
      el.childNodes.forEach((n) => {
        if (n.nodeType === Node.ELEMENT_NODE) out.push(...convertBlock(n as Element));
        else if (n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim()) {
          out.push(plainParagraph(n.textContent ?? ""));
        }
      });
      return out;
    }
  }
}

/** mammoth 输出的 HTML → 编辑器 JSON（已清洗，可直接 setContent） */
export function htmlToContent(html: string): JSONContent {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: JSONContent[] = [];
  doc.body.childNodes.forEach((n) => {
    if (n.nodeType === Node.ELEMENT_NODE) blocks.push(...convertBlock(n as Element));
    else if (n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim()) {
      blocks.push(plainParagraph(n.textContent ?? ""));
    }
  });
  if (!blocks.length) blocks.push({ type: "paragraph" });
  return normalizeDocContent({ type: "doc", content: blocks });
}
