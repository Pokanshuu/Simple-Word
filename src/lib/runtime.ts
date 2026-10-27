let cached: boolean | null = null;

export function isTauri(): boolean {
  if (cached !== null) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    cached = Boolean(w.__TAURI_INTERNALS__);
  } catch {
    cached = false;
  }
  return cached;
}

export function isFileSystemAccessSupported(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return typeof w.showOpenFilePicker === "function" && typeof w.showSaveFilePicker === "function";
}
