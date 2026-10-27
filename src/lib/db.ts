import Dexie, { type Table } from "dexie";
import type { DocRef } from "./types";

export interface Recent {
  key: string;
  title: string;
  kind: DocRef["kind"];
  path?: string;
  handleId?: number;
  openedAt: number;
}

export interface Draft {
  key: string;
  title: string;
  doc: string;
  updatedAt: number;
  /** 上次保存到磁盘时文件的 mtime，用于判断草稿是否比文件新 */
  fileMtime?: number;
}

export interface StoredHandle {
  id?: number;
  handle: FileSystemHandle;
}

export interface StoredSetting {
  key: string;
  value: unknown;
}

class SimpleOfficeDB extends Dexie {
  recents!: Table<Recent, string>;
  drafts!: Table<Draft, string>;
  handles!: Table<StoredHandle, number>;
  settings!: Table<StoredSetting, string>;

  constructor() {
    super("simple-office");
    this.version(1).stores({
      recents: "key, openedAt",
      drafts: "key, updatedAt",
      handles: "++id",
      settings: "key",
    });
  }
}

export const db = new SimpleOfficeDB();

export async function getRecentEntries(): Promise<Recent[]> {
  const recents = await db.recents.orderBy("openedAt").reverse().toArray();
  return recents;
}

export async function touchRecent(entry: Omit<Recent, "openedAt">): Promise<void> {
  await db.recents.put({ ...entry, openedAt: Date.now() });
}

export async function removeRecent(key: string): Promise<void> {
  await db.recents.delete(key);
}

export async function putDraft(draft: Draft): Promise<void> {
  await db.drafts.put(draft);
}

export async function getDraft(key: string): Promise<Draft | undefined> {
  return db.drafts.get(key);
}

export async function deleteDraft(key: string): Promise<void> {
  await db.drafts.delete(key);
}

export async function storeHandle(handle: FileSystemHandle): Promise<number> {
  const id = await db.handles.add({ handle });
  return id;
}

export async function getHandle(id: number): Promise<FileSystemHandle | undefined> {
  const row = await db.handles.get(id);
  return row?.handle;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  if (!row || row.value === undefined) return fallback;
  return row.value as T;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}
