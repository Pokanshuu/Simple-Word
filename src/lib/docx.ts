import type { JSONContent } from "@tiptap/react";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  LevelFormat,
  ImageRun,
  ExternalHyperlink,
  ShadingType,
  AlignmentType,
  HeadingLevel,
  type ISectionOptions,
  type ParagraphChild,
} from "docx";
import { htmlToContent } from "./htmlToContent";
import type { PageSettings } from "./types";

const HEADING_LEVELS: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

const ALIGN_MAP: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  A4: { width: 11906, height: 16838 },
  Letter: { width: 12240, height: 15840 },
};

export async function importDocx(bytes: ArrayBuffer): Promise<JSONContent> {
  const mammoth = (await import("mammoth/mammoth.browser.js")).default;
  const result = await mammoth.convertToHtml({ arrayBuffer: bytes });
  return htmlToContent(result.value);
}

/* ================= 导出 ================= */

interface MarkAcc {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  link?: string;
  code?: boolean;
}

function hexNoHash(color: string): string {
  return color.replace("#", "");
}

function parseDataUrl(src: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([^;,]+);base64,(.+)$/.exec(src);
  if (!m) return null;
  try {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime: m[1], bytes };
  } catch {
    return null;
  }
}

function imageType(mime: string): "jpg" | "png" | "gif" | "bmp" | "svg" {
  if (mime.includes("png")) return "png";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("svg")) return "svg";
  if (mime.includes("bmp")) return "bmp";
  return "jpg";
}

function mergeMarks(node: JSONContent, parent: MarkAcc): MarkAcc {
  const m = { ...parent };
  (node.marks ?? []).forEach((mark) => {
    switch (mark.type) {
      case "bold":
        m.bold = true;
        break;
      case "italic":
        m.italic = true;
        break;
      case "underline":
        m.underline = true;
        break;
      case "strike":
        m.strike = true;
        break;
      case "code":
        m.code = true;
        break;
      case "textStyle":
        if (mark.attrs?.color) m.color = String(mark.attrs.color);
        break;
      case "link":
        if (mark.attrs?.href) m.link = String(mark.attrs.href);
        break;
    }
  });
  return m;
}

function runProps(m: MarkAcc): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  if (m.bold) props.bold = true;
  if (m.italic) props.italics = true;
  if (m.underline) props.underline = {};
  if (m.strike) props.strike = true;
  if (m.color) props.color = hexNoHash(m.color);
  if (m.code) props.font = { name: "Consolas" };
  return props;
}

/** 将带 marks 的内容转为 Run[]（文本/hardBreak/image/link） */
function inlineRuns(children: JSONContent[] | undefined, parent: MarkAcc): ParagraphChild[] {
  const runs: ParagraphChild[] = [];
  (children ?? []).forEach((child) => {
    const m = mergeMarks(child, parent);
    if (m.link) {
      const stripped: JSONContent = {
        ...child,
        marks: (child.marks ?? []).filter((mk) => mk.type !== "link"),
      };
      runs.push(
        new ExternalHyperlink({
          link: m.link,
          children: inlineRuns([stripped], { ...m, link: undefined }) as never,
        }),
      );
      return;
    }
    if (child.type === "text") {
      const text = child.text ?? "";
      if (!text && !Object.keys(runProps(m)).length) return;
      runs.push(new TextRun({ text, ...runProps(m) }));
      return;
    }
    if (child.type === "hardBreak") {
      runs.push(new TextRun({ break: 1 }));
      return;
    }
    if (child.type === "image" && child.attrs?.src) {
      const parsed = parseDataUrl(String(child.attrs.src));
      if (parsed) {
        const w = Number(child.attrs.width) || 300;
        const h = Number(child.attrs.height) || 200;
        const type = imageType(parsed.mime);
        const options: Record<string, unknown> = {
          type,
          data: parsed.bytes,
          transformation: { width: Math.round(w * 9525), height: Math.round(h * 9525) },
        };
        if (type === "svg") {
          options.fallback = { type: "png", data: parsed.bytes };
        }
        runs.push(new ImageRun(options as never));
      }
      return;
    }
    runs.push(...inlineRuns(child.content, m));
  });
  return runs;
}

/** 将段落内容压平为 Run[]（列表项/表格单元格内可能有嵌套段落） */
function paragraphRuns(node: JSONContent): ParagraphChild[] {
  const runs: ParagraphChild[] = [];
  (node.content ?? []).forEach((child) => {
    if (child.type === "paragraph") {
      runs.push(...inlineRuns(child.content, {}));
    } else if (child.type === "text" || child.type === "hardBreak" || child.type === "image") {
      runs.push(...inlineRuns([child], {}));
    } else if (child.content) {
      child.content.forEach((c) => runs.push(...inlineRuns(c.content, {})));
    }
  });
  return runs;
}

function blockToDocx(node: JSONContent): (Paragraph | Table)[] {
  switch (node.type) {
    case "paragraph": {
      const align = node.attrs?.textAlign ? ALIGN_MAP[String(node.attrs.textAlign)] : undefined;
      return [new Paragraph({ children: inlineRuns(node.content, {}), alignment: align })];
    }
    case "heading": {
      const level = Number(node.attrs?.level ?? 1);
      return [
        new Paragraph({
          heading: HEADING_LEVELS[level] ?? HeadingLevel.HEADING_1,
          children: inlineRuns(node.content, {}),
        }),
      ];
    }
    case "bulletList":
    case "orderedList": {
      const out: Paragraph[] = [];
      const walkList = (list: JSONContent, level: number) => {
        (list.content ?? []).forEach((item) => {
          if (item.type !== "listItem") return;
          const parts: JSONContent[] = [];
          const subLists: JSONContent[] = [];
          (item.content ?? []).forEach((child) => {
            if (child.type === "bulletList" || child.type === "orderedList") subLists.push(child);
            else parts.push(child);
          });
          const runs = parts.flatMap((part) => paragraphRuns(part));
          const isOrdered = node.type === "orderedList";
          out.push(
            new Paragraph({
              numbering: { reference: isOrdered ? "sw-ordered" : "sw-bullets", level },
              children: runs.length ? runs : [new TextRun({ text: "" })],
            }),
          );
          subLists.forEach((sub) => walkList(sub, Math.min(level + 1, 2)));
        });
      };
      walkList(node, 0);
      return out;
    }
    case "taskList": {
      const out: Paragraph[] = [];
      (node.content ?? []).forEach((item) => {
        if (item.type !== "taskItem") return;
        const runs = (item.content ?? []).flatMap((part) => paragraphRuns(part));
        out.push(
          new Paragraph({
            numbering: { reference: "sw-bullets", level: 0 },
            children: [new TextRun({ text: "☐ " }), ...runs],
          }),
        );
      });
      return out;
    }
    case "blockquote": {
      const out: (Paragraph | Table)[] = [];
      const quoteOpts = {
        indent: { left: 360 },
        border: { left: { style: BorderStyle.SINGLE, color: "E7E3DC", size: 18, space: 4 } },
      };
      (node.content ?? []).forEach((child) => {
        if (child.type === "paragraph") {
          out.push(new Paragraph({ children: inlineRuns(child.content, {}), ...quoteOpts }));
        } else if (child.type === "heading") {
          const level = Number(child.attrs?.level ?? 2);
          out.push(
            new Paragraph({
              heading: HEADING_LEVELS[level] ?? HeadingLevel.HEADING_2,
              children: inlineRuns(child.content, {}),
              ...quoteOpts,
            }),
          );
        } else {
          out.push(...blockToDocx(child));
        }
      });
      return out;
    }
    case "codeBlock": {
      const text = node.content?.map((c) => c.text ?? "").join("") ?? "";
      return [
        new Paragraph({
          shading: { type: ShadingType.CLEAR, fill: "F3EFE9" },
          spacing: { line: 264 },
          children: [new TextRun({ text, font: { name: "Consolas" }, size: 20 })],
        }),
      ];
    }
    case "horizontalRule":
      return [
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, color: "D6D0C4", size: 6 } },
          children: [],
        }),
      ];
    case "table": {
      const rows = (node.content ?? []).map((row) => {
        const cells = (row.content ?? []).map((cell) => {
          const paras =
            (cell.content ?? []).length > 0
              ? ((cell.content ?? []).flatMap((c) => blockToDocx(c)).filter(
                  (b) => b instanceof Paragraph,
                ) as Paragraph[])
              : [new Paragraph({ children: [] })];
          const isHeader = cell.type === "tableHeader";
          return new TableCell({
            children: paras.length ? paras : [new Paragraph({ children: [] })],
            shading: isHeader ? { type: ShadingType.CLEAR, fill: "FAF7F2" } : undefined,
          });
        });
        return new TableRow({ children: cells });
      });
      return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })];
    }
    default:
      return [];
  }
}

export async function exportDocx(opts: {
  title: string;
  content: JSONContent | null;
  settings: { page: PageSettings };
}): Promise<Blob> {
  const blocks = (opts.content?.content ?? []).flatMap((node) => blockToDocx(node));

  const { size, orientation, margin } = opts.settings.page;
  const dims = PAGE_SIZES[size] ?? PAGE_SIZES.A4;
  const landscape = orientation === "landscape";
  const pageWidth = landscape ? dims.height : dims.width;
  const pageHeight = landscape ? dims.width : dims.height;

  const section: ISectionOptions = {
    properties: {
      page: {
        size: { width: pageWidth, height: pageHeight },
        margin: {
          top: Math.round(margin.top * 20),
          right: Math.round(margin.right * 20),
          bottom: Math.round(margin.bottom * 20),
          left: Math.round(margin.left * 20),
        },
      },
    },
    children: blocks,
  };

  const doc = new Document({
    creator: "Simple Word",
    title: opts.title,
    description: "Generated by Simple Word",
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
      },
    },
    numbering: {
      config: [
        {
          reference: "sw-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
            {
              level: 1,
              format: LevelFormat.BULLET,
              text: "◦",
              style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
            },
          ],
        },
        {
          reference: "sw-ordered",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
            {
              level: 1,
              format: LevelFormat.LOWER_LETTER,
              text: "%2)",
              style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [section],
  });

  return Packer.toBlob(doc);
}
