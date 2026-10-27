import type { SowdDoc } from "./types";
import { DEFAULT_PALETTE } from "./palette";

const APP_VERSION = "0.1.0";

export function createSowd(title: string, now = Date.now()): SowdDoc {
  return {
    meta: {
      format: "sowd",
      version: 1,
      title,
      createdAt: now,
      updatedAt: now,
      app: { name: "simple-word", version: APP_VERSION },
    },
    settings: {
      page: {
        size: "A4",
        orientation: "portrait",
        margin: { top: 72, right: 72, bottom: 72, left: 72 },
      },
    },
    content: {
      type: "doc",
      content: [{ type: "paragraph" }],
    },
    styles: { palette: [...DEFAULT_PALETTE] },
  };
}

export function parseSowd(text: string): SowdDoc {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("文件损坏：不是有效的 JSON 文档");
  }
  const obj = raw as Partial<SowdDoc>;
  if (!obj || obj.meta?.format !== "sowd") {
    throw new Error("不是 Simple Word 文档（.sowd）");
  }
  return {
    meta: {
      format: "sowd",
      version: 1,
      title: obj.meta?.title ?? "未命名文档",
      createdAt: obj.meta?.createdAt ?? Date.now(),
      updatedAt: obj.meta?.updatedAt ?? Date.now(),
      app: {
        name: obj.meta?.app?.name ?? "simple-word",
        version: obj.meta?.app?.version ?? APP_VERSION,
      },
    },
    settings: {
      page: {
        size: obj.settings?.page?.size ?? "A4",
        orientation: obj.settings?.page?.orientation ?? "portrait",
        margin: {
          top: obj.settings?.page?.margin?.top ?? 72,
          right: obj.settings?.page?.margin?.right ?? 72,
          bottom: obj.settings?.page?.margin?.bottom ?? 72,
          left: obj.settings?.page?.margin?.left ?? 72,
        },
      },
    },
    content: (obj.content as SowdDoc["content"]) ?? null,
    styles: { palette: obj.styles?.palette?.length ? obj.styles.palette : [...DEFAULT_PALETTE] },
  };
}

export function serializeSowd(doc: SowdDoc): string {
  return JSON.stringify(doc, null, 2);
}

export function stripExt(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return name;
  const ext = name.slice(idx + 1).toLowerCase();
  if (ext === "sowd" || ext === "docx") return name.slice(0, idx);
  return name;
}

export function ensureExt(name: string, ext: string): string {
  const base = stripExt(name);
  return `${base}.${ext}`;
}
