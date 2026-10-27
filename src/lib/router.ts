import { useSyncExternalStore } from "react";
import type { DocRef, SowdDoc } from "./types";

export interface OpenSession {
  ref: DocRef | null;
  sowd?: SowdDoc;
  /** 需要在编辑器中异步读取 ref（最近文件打开） */
  needOpen?: boolean;
  /** docx 导入：内容来自 docx，尚未保存为 .sowd */
  importedFromDocx?: boolean;
  /** 打开文件时磁盘上的 mtime，用于草稿恢复判断 */
  mtime?: number;
}

export type Route = { page: "home" } | { page: "editor"; session: OpenSession };

let current: Route = { page: "home" };
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getRoute(): Route {
  return current;
}

export function navigate(route: Route) {
  current = route;
  try {
    window.history.replaceState(null, "", route.page === "home" ? "#/" : "#/editor");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, getRoute);
}
