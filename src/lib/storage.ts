import { isTauri, isFileSystemAccessSupported } from "./runtime";
import type { DocRef } from "./types";
import { getHandle, storeHandle } from "./db";
import { ensureExt } from "./sowd";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface OpenedFile {
  ref: DocRef;
  kind: "sowd" | "docx";
  text: string;
  bytes: ArrayBuffer | null;
  mtime: number;
}

const ALL_FILTER = [
  { name: "Simple Word 文档", extensions: ["sowd"] },
  { name: "Word 文档", extensions: ["docx"] },
  { name: "所有文件", extensions: ["*"] },
];

const DOCX_FILTER = [{ name: "Word 文档", extensions: ["docx"] }];

const IMAGE_FILTER = [
  { name: "图片", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"] },
];

function detectKind(name: string): "sowd" | "docx" {
  return name.toLowerCase().endsWith(".docx") ? "docx" : "sowd";
}

function baseName(path: string): string {
  const idx = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return idx >= 0 ? path.slice(idx + 1) : path;
}

function exactBytes(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

async function bytesToDataUrl(bytes: ArrayBuffer, mime: string): Promise<string> {
  return blobToDataUrl(new Blob([bytes], { type: mime }));
}

/* ============ Tauri ============ */

async function tauriOpen(docxOnly: boolean): Promise<OpenedFile | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const fs = await import("@tauri-apps/plugin-fs");
  const selected = await open({
    multiple: false,
    filters: docxOnly ? DOCX_FILTER : ALL_FILTER,
  });
  if (!selected || Array.isArray(selected)) return null;
  const path = selected;
  const name = baseName(path);
  const kind = detectKind(name);
  let text = "";
  let bytes: ArrayBuffer | null = null;
  if (kind === "docx") {
    bytes = exactBytes(await fs.readFile(path));
  } else {
    text = await fs.readTextFile(path);
  }
  let mtime = Date.now();
  try {
    const st = await fs.stat(path);
    if (st.mtime) mtime = st.mtime.getTime();
  } catch {
    /* ignore */
  }
  return { ref: { kind: "tauri", path, name }, kind, text, bytes, mtime };
}

async function tauriOpenRef(ref: Extract<DocRef, { kind: "tauri" }>): Promise<OpenedFile | null> {
  const fs = await import("@tauri-apps/plugin-fs");
  try {
    const kind = detectKind(ref.path);
    const name = baseName(ref.path);
    let text = "";
    let bytes: ArrayBuffer | null = null;
    if (kind === "docx") {
      bytes = exactBytes(await fs.readFile(ref.path));
    } else {
      text = await fs.readTextFile(ref.path);
    }
    let mtime = Date.now();
    try {
      const st = await fs.stat(ref.path);
      if (st.mtime) mtime = st.mtime.getTime();
    } catch {
      /* ignore */
    }
    return { ref: { kind: "tauri", path: ref.path, name }, kind, text, bytes, mtime };
  } catch {
    return null;
  }
}

async function tauriSaveText(path: string, text: string): Promise<void> {
  const fs = await import("@tauri-apps/plugin-fs");
  await fs.writeTextFile(path, text);
}

async function tauriSaveBytes(path: string, bytes: ArrayBuffer): Promise<void> {
  const fs = await import("@tauri-apps/plugin-fs");
  await fs.writeFile(path, new Uint8Array(bytes));
}

async function tauriMtime(path: string): Promise<number | null> {
  const fs = await import("@tauri-apps/plugin-fs");
  try {
    const st = await fs.stat(path);
    return st.mtime ? st.mtime.getTime() : null;
  } catch {
    return null;
  }
}

async function tauriSaveAs(
  payload: string | Blob,
  opts: { name: string; ext: "sowd" | "docx" },
): Promise<DocRef | null> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const suggested = ensureExt(opts.name, opts.ext);
  const path = await save({
    defaultPath: suggested,
    filters: opts.ext === "docx" ? DOCX_FILTER : [{ name: "Simple Word 文档", extensions: ["sowd"] }],
  });
  if (!path) return null;
  if (typeof payload === "string") {
    await tauriSaveText(path, payload);
  } else {
    await tauriSaveBytes(path, await payload.arrayBuffer());
  }
  return { kind: "tauri", path, name: baseName(path) };
}

async function tauriPickImage(): Promise<{ dataUrl: string; name: string } | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const fs = await import("@tauri-apps/plugin-fs");
  const selected = await open({ multiple: false, filters: IMAGE_FILTER });
  if (!selected || Array.isArray(selected)) return null;
  const path = selected;
  const name = baseName(path);
  const dot = name.lastIndexOf(".");
  const ext = (dot >= 0 ? name.slice(dot + 1) : "png").toLowerCase();
  const mime = ext === "jpg" ? "jpeg" : ext === "svg" ? "svg+xml" : ext;
  const bytes = exactBytes(await fs.readFile(path));
  const dataUrl = await bytesToDataUrl(bytes, `image/${mime}`);
  return { dataUrl, name };
}

/* ============ Web (File System Access API) ============ */

function asFileHandle(handle: FileSystemHandle | null | undefined): FileSystemFileHandle | null {
  return handle && handle.kind === "file" ? (handle as FileSystemFileHandle) : null;
}

async function requestReadPermission(handle: FileSystemFileHandle): Promise<boolean> {
  try {
    let perm = await handle.queryPermission({ mode: "read" } as any);
    if (perm !== "granted") perm = await handle.requestPermission({ mode: "read" } as any);
    return perm === "granted";
  } catch {
    return true;
  }
}

async function requestWritePermission(handle: FileSystemFileHandle): Promise<boolean> {
  try {
    let perm = await handle.queryPermission({ mode: "readwrite" } as any);
    if (perm !== "granted") perm = await handle.requestPermission({ mode: "readwrite" } as any);
    return perm === "granted";
  } catch {
    return true;
  }
}

async function webOpenFromPicker(docxOnly: boolean): Promise<OpenedFile | null> {
  if (!isFileSystemAccessSupported()) return webOpenFallback(docxOnly);
  const w = window as any;
  try {
    const [fh] = await w.showOpenFilePicker({
      multiple: false,
      excludeAcceptAllOption: false,
      types: [
        {
          description: "文档",
          accept: docxOnly
            ? { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] }
            : {
                "application/json": [".sowd"],
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
              },
        },
      ],
    });
    return webFromHandle(fh);
  } catch {
    return null; // user cancelled
  }
}

async function webFromHandle(fh: FileSystemFileHandle): Promise<OpenedFile> {
  const file = await fh.getFile();
  const handleId = await storeHandle(fh);
  const kind = detectKind(file.name);
  let text = "";
  let bytes: ArrayBuffer | null = null;
  if (kind === "docx") bytes = await file.arrayBuffer();
  else text = await file.text();
  return {
    ref: { kind: "web", handleId, name: file.name },
    kind,
    text,
    bytes,
    mtime: file.lastModified || Date.now(),
  };
}

async function webOpenRef(ref: Extract<DocRef, { kind: "web" }>): Promise<OpenedFile | null> {
  const handle = await getHandle(ref.handleId);
  const fh = asFileHandle(handle ?? null);
  if (!fh) return null;
  if (!(await requestReadPermission(fh))) return null;
  try {
    return await webFromHandle(fh);
  } catch {
    return null;
  }
}

async function webSaveTo(ref: Extract<DocRef, { kind: "web" }>, payload: string | Blob): Promise<number | null> {
  const handle = await getHandle(ref.handleId);
  const fh = asFileHandle(handle ?? null);
  if (!fh) return null;
  if (!(await requestWritePermission(fh))) return null;
  const writable = await fh.createWritable();
  await writable.write(payload);
  await writable.close();
  const file = await fh.getFile();
  return file.lastModified || Date.now();
}

async function webSaveAs(
  payload: string | Blob,
  opts: { name: string; ext: "sowd" | "docx" },
): Promise<DocRef | null> {
  const suggested = ensureExt(opts.name, opts.ext);
  if (isFileSystemAccessSupported()) {
    const w = window as any;
    try {
      const fh = await w.showSaveFilePicker({
        suggestedName: suggested,
        types: [
          {
            description: opts.ext === "docx" ? "Word 文档" : "Simple Word 文档",
            accept:
              opts.ext === "docx"
                ? { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] }
                : { "application/json": [".sowd"] },
          },
        ],
      });
      const handleId = await storeHandle(fh);
      const writable = await fh.createWritable();
      await writable.write(payload);
      await writable.close();
      return { kind: "web", handleId, name: suggested };
    } catch {
      return null; // cancelled
    }
  }
  // fallback: download
  const url = URL.createObjectURL(
    typeof payload === "string"
      ? new Blob([payload], { type: "application/json" })
      : payload,
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = suggested;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { kind: "web-name", name: suggested };
}

function webOpenFallback(docxOnly: boolean): Promise<OpenedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = docxOnly ? ".docx" : ".sowd,.docx";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const kind = detectKind(file.name);
      let text = "";
      let bytes: ArrayBuffer | null = null;
      if (kind === "docx") bytes = await file.arrayBuffer();
      else text = await file.text();
      resolve({
        ref: { kind: "web-name", name: file.name },
        kind,
        text,
        bytes,
        mtime: file.lastModified || Date.now(),
      });
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

async function webPickImage(): Promise<{ dataUrl: string; name: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const fr = new FileReader();
      fr.onload = () => resolve({ dataUrl: fr.result as string, name: file.name });
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(file);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

/* ============ 对外服务 ============ */

export const fileService = {
  isTauri: () => isTauri(),

  async open(docxOnly = false): Promise<OpenedFile | null> {
    return isTauri() ? tauriOpen(docxOnly) : webOpenFromPicker(docxOnly);
  },

  async openRef(ref: DocRef): Promise<OpenedFile | null> {
    if (ref.kind === "tauri") return tauriOpenRef(ref);
    if (ref.kind === "web") return webOpenRef(ref);
    return null; // web-name：浏览器无法静默读取本地文件
  },

  async saveTo(ref: DocRef, payload: string | Blob): Promise<number | null> {
    if (ref.kind === "tauri") {
      if (typeof payload === "string") await tauriSaveText(ref.path, payload);
      else await tauriSaveBytes(ref.path, await payload.arrayBuffer());
      return tauriMtime(ref.path);
    }
    if (ref.kind === "web") return webSaveTo(ref, payload);
    return null;
  },

  async saveAs(
    payload: string | Blob,
    opts: { name: string; ext: "sowd" | "docx" },
  ): Promise<DocRef | null> {
    return isTauri() ? tauriSaveAs(payload, opts) : webSaveAs(payload, opts);
  },

  async mtimeOf(ref: DocRef): Promise<number | null> {
    if (ref.kind === "tauri") return tauriMtime(ref.path);
    if (ref.kind === "web") {
      const handle = await getHandle(ref.handleId);
      const fh = asFileHandle(handle ?? null);
      if (!fh) return null;
      if (!(await requestReadPermission(fh))) return null;
      try {
        const file = await fh.getFile();
        return file.lastModified || null;
      } catch {
        return null;
      }
    }
    return null;
  },

  pickImage(): Promise<{ dataUrl: string; name: string } | null> {
    return isTauri() ? tauriPickImage() : webPickImage();
  },
};
