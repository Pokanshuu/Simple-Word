/**
 * 从粘贴 / 拖拽事件里挑出图片文件（纯函数）。
 *
 * 两种事件的数据来源不一样，缺一个就会静默漏图：
 *   - drop：真实文件在 `dataTransfer.files`
 *   - paste：截图/复制的图在 `clipboardData.items`，`files` 常常为空
 *     （paste 事件的属性是 `clipboardData`，不是 `dataTransfer`）
 */
export interface TransferLike {
  files?: ArrayLike<File> | null;
  items?: ArrayLike<TransferItemLike> | null;
}

export interface TransferItemLike {
  kind?: string;
  type?: string;
  getAsFile?: () => File | null;
}

const IMAGE_EXT_RE = /\.(?:png|jpe?g|gif|webp|bmp|svg|avif|heic|heif)$/i;

export function isImageFile(file: { type?: string; name?: string }): boolean {
  if (file.type?.startsWith("image/")) return true;
  return Boolean(file.name && IMAGE_EXT_RE.test(file.name));
}

const isFile = (value: unknown): value is File =>
  Boolean(value) && typeof (value as File).name === "string";

/** 取出这次事件携带的图片文件（保持原顺序，同一个文件只收一次） */
export function getImageFiles(transfer: TransferLike | null | undefined): File[] {
  if (!transfer) return [];
  const out: File[] = [];
  const push = (file: unknown) => {
    if (!isFile(file) || !isImageFile(file)) return;
    if (out.includes(file)) return;
    out.push(file);
  };

  const files = transfer.files;
  if (files) for (let i = 0; i < files.length; i += 1) push(files[i]);

  const items = transfer.items;
  if (items) {
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!item || item.kind !== "file") continue;
      push(item.getAsFile?.() ?? null);
    }
  }
  return out;
}
