import type { JSONContent } from "@tiptap/react";

export interface PageSettings {
  size: "A4" | "Letter";
  orientation: "portrait" | "landscape";
  /** 单位 pt */
  margin: { top: number; right: number; bottom: number; left: number };
}

export interface SowdDoc {
  meta: {
    format: "sowd";
    version: 1;
    title: string;
    createdAt: number;
    updatedAt: number;
    app: { name: string; version: string };
  };
  settings: { page: PageSettings };
  content: JSONContent | null;
  styles: { palette: string[] };
}

export type DocRef =
  | { kind: "tauri"; path: string; name: string }
  | { kind: "web"; handleId: number; name: string }
  | { kind: "web-name"; name: string }
  | { kind: "unsaved"; key: string; name: string };

export function refKey(ref: DocRef | null | undefined): string {
  if (!ref) return "unsaved:memory";
  switch (ref.kind) {
    case "tauri":
      return `path:${ref.path}`;
    case "web":
      return `handle:${ref.handleId}`;
    case "web-name":
      return `name:${ref.name}`;
    case "unsaved":
      return `unsaved:${ref.key}`;
  }
}

export function docTitleOf(ref: DocRef | null | undefined, fallback = "未命名文档"): string {
  return ref?.name ?? fallback;
}
