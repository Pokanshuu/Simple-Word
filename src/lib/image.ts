/**
 * 图片预处理：读尺寸、压缩、统一成 .sowd / .docx 都能接受的 data URL。
 *
 * 桌面版没有服务器媒体库，图片只能内嵌进 .sowd。原实现直接把原图 data URL
 * 写进文档，一张手机照片就是 5–10 MB，自动保存和 docx 导出都会被拖垮。
 * 这里在**插入/粘贴/导入**三个入口统一做一次：
 *
 * - 最长边压到 1600px（纸张正文宽约 650px，2.5 倍足够 200% 缩放）；
 * - JPEG 保持 JPEG，其它格式转 PNG/JPEG（docx 库不支持 WebP）；
 * - 记录真实宽高，供编辑器显示与 docx 导出（旧版固定导出 300×200，图会变形）；
 * - 小于阈值且尺寸合规的图片原样保留，不做二次编码。
 *
 * 所有函数只在浏览器调用（依赖 Image / canvas）。
 */
import type { JSONContent } from "@tiptap/react";

export interface PreparedImage {
  src: string;
  width: number;
  height: number;
  name: string;
  /** 是否发生了重编码（用于提示） */
  recompressed: boolean;
  originalBytes: number;
  bytes: number;
}

const MAX_EDGE = 1600;
const KEEP_BELOW_BYTES = 700 * 1024;
const KEEP_BELOW_EDGE = MAX_EDGE;

function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return 0;
  return Math.round(((dataUrl.length - comma - 1) * 3) / 4);
}

function dataUrlMime(dataUrl: string): string {
  return /^data:([^;,]+)/i.exec(dataUrl)?.[1]?.toLowerCase() ?? "";
}

export function readImageSize(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (value: { width: number; height: number } | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    // 远程图片可能永远不触发 load/error（断网、慢代理）。没有超时的话，
    // 打开一篇带远程插图的文档会一直卡在"正在打开文档"。
    const timer = window.setTimeout(() => finish(null), 4000);
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      finish(width > 0 && height > 0 ? { width, height } : null);
    };
    img.onerror = () => finish(null);
    img.src = src;
  });
}

async function toCanvas(
  src: string,
  width: number,
  height: number,
): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null> {
  const img = new Image();
  img.decoding = "async";
  const loaded = new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(ok);
    };
    const timer = window.setTimeout(() => finish(false), 8000);
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
  });
  img.src = src;
  if (!(await loaded)) return null;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

/** 采样判断画布是否真的含透明像素（决定 PNG 还是 JPEG） */
function hasAlpha(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const stepX = Math.max(1, Math.floor(width / 120));
    const stepY = Math.max(1, Math.floor(height / 120));
    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) {
        if (ctx.getImageData(x, y, 1, 1).data[3] < 250) return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * 把任意图片 data URL 处理成可内嵌的 data URL。
 * `name` 只用于 alt 文本和错误提示；缺省时从 mime 推断。
 */
export async function prepareImageDataUrl(
  src: string,
  name = "image",
  maxEdge = MAX_EDGE,
): Promise<PreparedImage | null> {
  const mime = dataUrlMime(src);
  if (!mime.startsWith("image/")) return null;
  const size = await readImageSize(src);
  if (!size) return null;

  const originalBytes = dataUrlBytes(src);
  const scale = Math.min(1, maxEdge / Math.max(size.width, size.height));
  const targetW = Math.max(1, Math.round(size.width * scale));
  const targetH = Math.max(1, Math.round(size.height * scale));
  const smallEnough =
    scale === 1 && originalBytes <= KEEP_BELOW_BYTES && size.width <= KEEP_BELOW_EDGE;

  // 已经是 docx 能直接吃的格式、且体积合规：原样保留
  if (smallEnough && /image\/(?:png|jpe?g|gif|bmp)/.test(mime)) {
    return {
      src,
      width: size.width,
      height: size.height,
      name,
      recompressed: false,
      originalBytes,
      bytes: originalBytes,
    };
  }

  const drawn = await toCanvas(src, targetW, targetH);
  if (!drawn) {
    return {
      src,
      width: size.width,
      height: size.height,
      name,
      recompressed: false,
      originalBytes,
      bytes: originalBytes,
    };
  }

  const wantsPng = mime.includes("png") || mime.includes("gif") || mime.includes("svg");
  const alpha = wantsPng ? hasAlpha(drawn.ctx, targetW, targetH) : false;
  let out = "";
  if (wantsPng || alpha) {
    out = drawn.canvas.toDataURL("image/png");
    // PNG 压不下来时，无透明通道的图退回 JPEG
    if (!alpha && dataUrlBytes(out) > 3 * 1024 * 1024) {
      const jpeg = drawn.canvas.toDataURL("image/jpeg", 0.86);
      if (dataUrlBytes(jpeg) < dataUrlBytes(out)) out = jpeg;
    }
  } else {
    out = drawn.canvas.toDataURL("image/jpeg", 0.86);
  }

  // 重编码反而更大（小图/简单图）时保留原图
  if (!out || dataUrlBytes(out) >= originalBytes * 1.05) {
    return {
      src,
      width: size.width,
      height: size.height,
      name,
      recompressed: false,
      originalBytes,
      bytes: originalBytes,
    };
  }

  return {
    src: out,
    width: targetW,
    height: targetH,
    name,
    recompressed: true,
    originalBytes,
    bytes: dataUrlBytes(out),
  };
}

/**
 * 把文档里已经存在的 data: 图片重编码一次（docx 导入用）。
 *
 * Word 里的照片动辄 4000px / 8MB，mammoth 会原样转成 data URL。如果直接写进
 * .sowd，自动保存和 docx 导出都会被拖垮；这里在导入链路上统一压缩。
 */
export async function optimizeEmbeddedImages(
  doc: JSONContent | null | undefined,
  maxEdge = MAX_EDGE,
): Promise<JSONContent> {
  const root = doc ?? { type: "doc", content: [] };
  const jobs: Promise<void>[] = [];
  const walk = (node: JSONContent): JSONContent => {
    if (node.type === "image" && typeof node.attrs?.src === "string" && node.attrs.src.startsWith("data:")) {
      const src = node.attrs.src;
      const alt = String(node.attrs.alt ?? "image");
      jobs.push(
        (async () => {
          const prepared = await prepareImageDataUrl(src, alt, maxEdge);
          if (!prepared) return;
          node.attrs = {
            ...node.attrs,
            src: prepared.src,
            width: prepared.width,
            height: prepared.height,
          };
        })(),
      );
      return node;
    }
    if (node.content) node.content = node.content.map(walk);
    return node;
  };
  const out = { ...root, content: (root.content ?? []).map(walk) };
  await Promise.all(jobs);
  return out;
}

export async function prepareImageFile(file: File, maxEdge = MAX_EDGE): Promise<PreparedImage | null> {
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  if (!src) return null;
  return prepareImageDataUrl(src, file.name || "image", maxEdge);
}

/**
 * 给没有宽高的图片补上尺寸（旧 .sowd、docx 导入的图）。
 * 只处理 data:/http(s)/相对路径，失败就跳过；最多把宽度钳到 640px，
 * 避免一张 4000px 的图在纸上被压成 1px 高、导出 docx 又撑爆页面。
 */
export async function hydrateImageSizes(doc: JSONContent | null | undefined): Promise<JSONContent> {
  const root = doc ?? { type: "doc", content: [] };
  const jobs: Promise<void>[] = [];

  const walk = (node: JSONContent): JSONContent => {
    if (node.type === "image" && node.attrs?.src) {
      const width = Number(node.attrs.width);
      const height = Number(node.attrs.height);
      if (width > 0 && height > 0) return node;
      const src = String(node.attrs.src);
      jobs.push(
        (async () => {
          const size = await readImageSize(src);
          if (!size) return;
          const clamp = Math.min(1, 640 / size.width);
          node.attrs = {
            ...node.attrs,
            width: Math.round(size.width * clamp),
            height: Math.round(size.height * clamp),
          };
        })(),
      );
      return node;
    }
    if (node.content) node.content = node.content.map(walk);
    return node;
  };

  const out = { ...root, content: (root.content ?? []).map(walk) };
  await Promise.all(jobs);
  return out;
}
