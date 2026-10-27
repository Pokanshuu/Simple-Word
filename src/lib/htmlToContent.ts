import type { JSONContent } from "@tiptap/react";

/** 将 mammoth 输出的 HTML 转为 TipTap JSONContent（覆盖常见 Word 结构） */

const BLOCKS = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "blockquote", "pre", "table", "div", "figure", "section", "article",
]);

interface MarkMap {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  link?: string;
}

function colorFromStyle(el: Element): string | undefined {
  const m = /color:\s*(#[0-9a-fA-F]{3,6}|rgb\([^)]+\))/.exec(el.getAttribute("style") ?? "");
  return m ? m[1] : undefined;
}

function parseBgColor(el: Element): string | undefined {
  const m = /background(?:-color)?:\s*(#[0-9a-fA-F]{3,6}|rgb\([^)]+\))/.exec(
    el.getAttribute("style") ?? "",
  );
  return m ? m[1] : undefined;
}

function isTransparent(color?: string): boolean {
  return !!color && /(255,\s*255,\s*255)|#ffffff|#fff/i.test(color);
}

function inlineOf(node: Node, marks: MarkMap): JSONContent[] {
  const out: JSONContent[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? "";
      if (!text) return;
      const content: JSONContent = { type: "text", text };
      const markArr: { type: string; attrs?: Record<string, unknown> }[] = [];
      if (marks.bold) markArr.push({ type: "bold" });
      if (marks.italic) markArr.push({ type: "italic" });
      if (marks.underline) markArr.push({ type: "underline" });
      if (marks.strike) markArr.push({ type: "strike" });
      if (marks.color && !isTransparent(marks.color)) {
        markArr.push({ type: "textStyle", attrs: { color: marks.color } });
      }
      if (marks.link) {
        markArr.push({
          type: "link",
          attrs: { href: marks.link, target: "_blank" },
        });
      }
      if (markArr.length) content.marks = markArr;
      out.push(content);
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as Element;
    const next = { ...marks };
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
      case "a": {
        const href = el.getAttribute("href");
        if (href) next.link = href;
        out.push(...inlineOf(el, next));
        break;
      }
      case "code":
        out.push(...inlineOf(el, next));
        break;
      case "img": {
        const src = el.getAttribute("src");
        if (src) out.push({ type: "image", attrs: { src, alt: el.getAttribute("alt") ?? "" } });
        break;
      }
      case "br":
        out.push({ type: "hardBreak" });
        break;
      case "sub":
      case "sup":
        out.push(...inlineOf(el, next));
        break;
      case "mark": {
        const bg = parseBgColor(el);
        if (bg) next.color = bg;
        out.push(...inlineOf(el, next));
        break;
      }
      default:
        out.push(...inlineOf(el, next));
    }
  });
  return out.length ? out : [];
}

function paragraphFrom(el: Element): JSONContent {
  const align = (el.getAttribute("align") ?? "").toLowerCase();
  const alignMap: Record<string, string> = {
    center: "center",
    right: "right",
    justify: "justify",
    left: "left",
  };
  const attrs: Record<string, unknown> = {};
  if (alignMap[align]) attrs.textAlign = alignMap[align];
  const style = el.getAttribute("style") ?? "";
  const textAlignM = /text-align:\s*(left|center|right|justify)/.exec(style);
  if (textAlignM) attrs.textAlign = textAlignM[1];
  const content = inlineOf(el, {});
  return { type: "paragraph", attrs: Object.keys(attrs).length ? attrs : undefined, content };
}

function wrapParagraph(content: JSONContent[] | undefined): JSONContent[] {
  if (!content || !content.length) return [{ type: "paragraph" }];
  return content;
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
      return [
        {
          type: "heading",
          attrs: { level: Number(tag[1]) },
          content: wrapParagraph(content),
        },
      ];
    }
    case "p":
      return [paragraphFrom(el)];
    case "ul":
    case "ol": {
      const items: JSONContent[] = [];
      el.querySelectorAll(":scope > li").forEach((li) => {
        items.push(convertListItem(li));
      });
      return [{ type: tag === "ul" ? "bulletList" : "orderedList", content: items }];
    }
    case "blockquote": {
      const children: JSONContent[] = [];
      el.childNodes.forEach((n) => {
        if (n.nodeType === Node.ELEMENT_NODE) children.push(...convertBlock(n as Element));
      });
      return [{ type: "blockquote", content: children.length ? children : [{ type: "paragraph" }] }];
    }
    case "pre": {
      const text = el.textContent ?? "";
      const codeEl = el.querySelector("code");
      const lang =
        codeEl?.className?.match(/language-([\w-]+)/)?.[1] ?? "";
      return [
        {
          type: "codeBlock",
          attrs: lang ? { language: lang } : undefined,
          content: text
            ? [{ type: "text", text: text.replace(/\n$/, "") }]
            : [{ type: "text", text: "" }],
        },
      ];
    }
    case "table":
      return [convertTable(el)];
    case "hr":
      return [{ type: "horizontalRule" }];
    case "img": {
      const src = el.getAttribute("src");
      return src
        ? [{ type: "paragraph", content: [{ type: "image", attrs: { src, alt: "" } }] }]
        : [];
    }
    case "figure": {
      const img = el.querySelector("img");
      if (img?.getAttribute("src")) {
        return [
          {
            type: "paragraph",
            content: [
              {
                type: "image",
                attrs: { src: img.getAttribute("src") ?? "", alt: img.getAttribute("alt") ?? "" },
              },
            ],
          },
        ];
      }
      return [];
    }
    default: {
      // div / section 等容器：递归提取子块
      const out: JSONContent[] = [];
      el.childNodes.forEach((n) => {
        if (n.nodeType === Node.ELEMENT_NODE) out.push(...convertBlock(n as Element));
        else if (n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim()) {
          out.push({ type: "paragraph", content: [{ type: "text", text: n.textContent ?? "" }] });
        }
      });
      return out;
    }
  }
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
      } else if (BLOCKS.has(tag)) {
        parts.push(...convertBlock(el));
      } else {
        const inline = inlineOf(el, {});
        if (inline.length) parts.push({ type: "paragraph", content: inline });
      }
    } else if (n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim()) {
      parts.push({ type: "paragraph", content: [{ type: "text", text: n.textContent ?? "" }] });
    }
  });
  if (!parts.length) parts.push({ type: "paragraph" });
  return { type: "listItem", content: [...parts, ...nested] };
}

function convertTable(table: Element): JSONContent {
  const rows: JSONContent[] = [];
  table.querySelectorAll("tr").forEach((tr) => {
    const cells: JSONContent[] = [];
    tr.querySelectorAll(":scope > th, :scope > td").forEach((cell) => {
      const isHeader = cell.tagName.toLowerCase() === "th";
      const paras: JSONContent[] = [];
      cell.childNodes.forEach((n) => {
        if (n.nodeType === Node.ELEMENT_NODE) paras.push(...convertBlock(n as Element));
      });
      if (!paras.length) paras.push({ type: "paragraph" });
      cells.push({ type: isHeader ? "tableHeader" : "tableCell", content: paras });
    });
    if (cells.length) {
      rows.push({ type: "tableRow", content: cells });
    }
  });
  return rows.length
    ? { type: "table", content: rows }
    : { type: "paragraph" };
}

export function htmlToContent(html: string): JSONContent {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;
  const blocks: JSONContent[] = [];
  body.childNodes.forEach((n) => {
    if (n.nodeType === Node.ELEMENT_NODE) {
      blocks.push(...convertBlock(n as Element));
    } else if (n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim()) {
      blocks.push({ type: "paragraph", content: [{ type: "text", text: n.textContent ?? "" }] });
    }
  });
  if (!blocks.length) blocks.push({ type: "paragraph" });
  return { type: "doc", content: blocks };
}
