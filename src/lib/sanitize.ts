/**
 * 编辑器内容的 URL 消毒与 JSON 清洗（纯函数，浏览器/Node 均可用）。
 *
 * 移植自 Simple_Blog 的 `src/lib/word-editor/sanitize.ts`，针对 .sowd 的
 * ProseMirror JSON 结构做了适配。它解决三类会**静默毁掉文档**的问题：
 *
 * 1. 导入的 docx / 手打链接可以带 `javascript:`，保存进 .sowd 后再打开会执行；
 * 2. `{type:"text", text:""}` 是非法节点，prosemirror-model 会拒绝整篇文档，
 *    表现为「打开后一片空白」；
 * 3. 旧版 docx 导入把图片塞在段落外（图片扩展当时是 block），schema 不认，
 *    同样会整篇打不开。`migrateBlockImages()` 把这类图片包回段落，让旧文件也能打开。
 */
import type { JSONContent } from "@tiptap/react";

const SAFE_URL_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * 链接 href 白名单：http/https/mailto/tel、站内绝对路径、#锚点、相对路径。
 * 其余（javascript:、data:、vbscript:、file: 等）返回 ''，调用方应视为无链接。
 */
export function safeHref(raw: unknown): string {
  const url = String(raw ?? "")
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, "");
  if (!url) return "";
  if (url.startsWith("#")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return "";
    }
    return SAFE_URL_SCHEMES.has(parsed.protocol) ? url : "";
  }
  // 反斜杠在部分浏览器里会被当作路径分隔符；含反斜杠的"相对路径"不接受
  if (url.includes("\\")) return "";
  return url;
}

/** 图片 src 允许 http(s)、data:image、站内/相对路径 */
export function safeImageSrc(raw: unknown): string {
  const src = String(raw ?? "").trim();
  if (!src) return "";
  if (/^data:image\/(?:png|jpe?g|gif|webp|bmp|svg\+xml);base64,/i.test(src)) return src;
  return safeHref(src);
}

/** 允许的颜色：3/6 位 hex、rgb()/rgba()、CSS 变量 */
export function safeColor(raw: unknown): string | undefined {
  const color = String(raw ?? "").trim();
  if (!color) return undefined;
  if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) return color;
  if (/^rgba?\(\s*[\d.\s,%]+\)$/.test(color)) return color;
  if (/^var\(--[A-Za-z0-9-]+\)$/.test(color)) return color;
  return undefined;
}

const MARK_TYPES = new Set(["bold", "italic", "underline", "strike", "code", "link", "textStyle"]);

function cleanMarks(marks: JSONContent["marks"]): JSONContent["marks"] | undefined {
  if (!marks?.length) return undefined;
  const out: NonNullable<JSONContent["marks"]> = [];
  const seen = new Set<string>();
  for (const mark of marks) {
    if (!MARK_TYPES.has(mark.type)) continue;
    if (mark.type === "link") {
      const href = safeHref(mark.attrs?.href);
      if (!href) continue; // 危险链接 → 摘掉链接，保留文字
      const next = { ...mark, attrs: { ...(mark.attrs ?? {}), href } };
      const key = `link:${href}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(next);
      continue;
    }
    if (mark.type === "textStyle") {
      const color = safeColor(mark.attrs?.color);
      if (!color) continue;
      const next = { ...mark, attrs: { ...(mark.attrs ?? {}), color } };
      const key = `textStyle:${color}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(next);
      continue;
    }
    if (seen.has(mark.type)) continue;
    seen.add(mark.type);
    out.push(mark);
  }
  return out.length ? out : undefined;
}

/**
 * 必须有子节点的容器类型（content 为空时 prosemirror-model 会抛错，需整节点剔除）。
 */
/**
 * 当前 schema 认识的节点。未知节点（来自未来版本/损坏文件）必须丢弃：
 * `Node.fromJSON` 遇到未知 type 会抛错，整个文档会打不开。
 */
const NODE_TYPES = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "hardBreak",
  "horizontalRule",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "blockquote",
  "codeBlock",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
  "image",
]);

const REQUIRE_CHILDREN = new Set([
  "bulletList",
  "orderedList",
  "taskList",
  "listItem",
  "taskItem",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
  "blockquote",
]);

function positive(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}

/**
 * 递归清洗文档 JSON：
 * - 剔除空文本节点
 * - 消毒 link href / image src / textStyle color
 * - 丢弃没有子节点的列表、表格、引用等非法空壳
 * - 保留空段落（合法的"空行"）
 */
export function sanitizeDocJson(doc: JSONContent | null | undefined): JSONContent {
  const walk = (node: JSONContent): JSONContent | null => {
    if (!node.type || !NODE_TYPES.has(node.type)) return null;

    const content = (node.content ?? [])
      .map(walk)
      .filter((n): n is JSONContent => n !== null);

    if (node.type === "text") {
      const text = node.text ?? "";
      if (!text) return null;
      const marks = cleanMarks(node.marks);
      return marks ? { ...node, text, marks } : { type: "text", text };
    }

    if (node.type === "image") {
      const src = safeImageSrc(node.attrs?.src);
      if (!src) return null;
      const attrs: Record<string, unknown> = {
        ...(node.attrs ?? {}),
        src,
        alt: String(node.attrs?.alt ?? ""),
      };
      const width = positive(node.attrs?.width);
      const height = positive(node.attrs?.height);
      if (width) attrs.width = width;
      else delete attrs.width;
      if (height) attrs.height = height;
      else delete attrs.height;
      return { type: "image", attrs };
    }

    if (node.type === "hardBreak" || node.type === "horizontalRule") return { type: node.type };

    const attrs = node.attrs ? { ...node.attrs } : undefined;
    if (attrs?.textAlign && !["left", "center", "right", "justify"].includes(String(attrs.textAlign))) {
      delete attrs.textAlign;
    }
    if (attrs?.color) {
      const color = safeColor(attrs.color);
      if (color) attrs.color = color;
      else delete attrs.color;
    }
    if (node.type === "heading" && attrs) {
      const level = Number(attrs.level);
      attrs.level = Number.isFinite(level) ? Math.min(6, Math.max(1, Math.round(level))) : 1;
    }
    if (node.type === "orderedList" && attrs) {
      const start = Number(attrs.start);
      attrs.start = Number.isFinite(start) && start >= 1 ? Math.round(start) : 1;
    }
    if (node.type === "taskItem" && attrs) {
      attrs.checked = Boolean(attrs.checked);
    }

    if (!content.length && REQUIRE_CHILDREN.has(node.type ?? "")) return null;

    return {
      ...node,
      attrs,
      marks: cleanMarks(node.marks),
      content: content.length ? content : undefined,
    };
  };

  const result = walk(doc ?? { type: "doc", content: [] });
  if (!result || result.type !== "doc") return { type: "doc", content: [{ type: "paragraph" }] };
  // doc 顶层必须是块节点；损坏文件里直接出现的 text/image 包回段落
  result.content = (result.content ?? []).map((node) =>
    node.type === "text" || node.type === "hardBreak" || node.type === "image"
      ? { type: "paragraph", content: [node] }
      : node,
  );
  if (!result.content.length) result.content = [{ type: "paragraph" }];
  return result;
}

/**
 * 旧版 docx 导入会把 `image` 直接放在 doc / blockquote / listItem / tableCell 下
 * （当时 Image 扩展是 block）。现在图片是 inline 节点，必须回到段落里。
 * 这里只在**非段落/标题**容器里把裸 image 包成段落，其他结构原样保留。
 */
export function migrateBlockImages(doc: JSONContent | null | undefined): JSONContent {
  const walk = (node: JSONContent, parent: string | null): JSONContent[] => {
    if (node.type === "image" && parent && parent !== "paragraph" && parent !== "heading") {
      return [{ type: "paragraph", content: [node] }];
    }
    if (!node.content?.length) return [node];
    const content: JSONContent[] = [];
    for (const child of node.content) content.push(...walk(child, node.type ?? null));
    return [{ ...node, content }];
  };
  const root = doc ?? { type: "doc", content: [] };
  const content = (root.content ?? []).flatMap((node) => walk(node, "doc"));
  return { ...root, content: content.length ? content : [{ type: "paragraph" }] };
}

/** 打开 .sowd 时的统一入口：迁移旧结构 + 清洗 + 兜底空文档 */
export function normalizeDocContent(content: JSONContent | null | undefined): JSONContent {
  return sanitizeDocJson(migrateBlockImages(content));
}
