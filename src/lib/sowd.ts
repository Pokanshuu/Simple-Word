import type { PageSettings, SowdDoc } from "./types";
import { DEFAULT_PALETTE, isValidHex } from "./palette";
import { normalizeDocContent, safeColor } from "./sanitize";

const APP_VERSION = "0.1.0";
const DEFAULT_PAGE: PageSettings = {
  size: "A4",
  orientation: "portrait",
  margin: { top: 72, right: 72, bottom: 72, left: 72 },
};

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
        ...DEFAULT_PAGE,
        margin: { ...DEFAULT_PAGE.margin },
      },
    },
    content: {
      type: "doc",
      content: [{ type: "paragraph" }],
    },
    styles: { palette: [...DEFAULT_PALETTE] },
  };
}

function clampMargin(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(240, Math.max(12, Math.round(n)));
}

/** 收敛页面设置：坏值不应该让整篇文档打不开 */
export function normalizePageSettings(raw: unknown): PageSettings {
  const page = (raw ?? {}) as Partial<PageSettings>;
  const margin = (page.margin ?? {}) as Partial<PageSettings["margin"]>;
  return {
    size: page.size === "Letter" ? "Letter" : "A4",
    orientation: page.orientation === "landscape" ? "landscape" : "portrait",
    margin: {
      top: clampMargin(margin.top, DEFAULT_PAGE.margin.top),
      right: clampMargin(margin.right, DEFAULT_PAGE.margin.right),
      bottom: clampMargin(margin.bottom, DEFAULT_PAGE.margin.bottom),
      left: clampMargin(margin.left, DEFAULT_PAGE.margin.left),
    },
  };
}

function normalizePalette(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (const value of list) {
    const color = safeColor(value);
    if (!color || out.includes(color)) continue;
    // .sowd 的色卡只接受 hex；rgb 值留给正文里的历史颜色
    if (isValidHex(color)) out.push(color);
  }
  return out.length ? out : [...DEFAULT_PALETTE];
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
      title: typeof obj.meta?.title === "string" && obj.meta.title ? obj.meta.title : "未命名文档",
      createdAt: Number(obj.meta?.createdAt) || Date.now(),
      updatedAt: Number(obj.meta?.updatedAt) || Date.now(),
      app: {
        name: obj.meta?.app?.name ?? "simple-word",
        version: obj.meta?.app?.version ?? APP_VERSION,
      },
    },
    settings: {
      page: normalizePageSettings(obj.settings?.page),
    },
    content: normalizeDocContent((obj.content as SowdDoc["content"]) ?? null),
    styles: { palette: normalizePalette(obj.styles?.palette) },
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
