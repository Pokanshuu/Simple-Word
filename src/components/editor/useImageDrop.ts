/**
 * 粘贴 / 拖拽图片 → 压缩 → 作为内联图片插入。
 *
 * 旧版只支持「插入图片」菜单，截图必须另存为文件再选；直接 Ctrl+V 会交给
 * TipTap 的默认粘贴处理，而 Image 扩展关了 base64 时图片会**静默消失**。
 *
 * 设计要点：
 * - 监听挂在 document 的 capture 阶段：`editor.view.dom` 会被 ProseMirror 重建，
 *   挂在上面的监听会随旧节点消失；capture 阶段也早于 TipTap 自己的 handlePaste。
 * - 只有确实带图片文件时才 preventDefault，纯文字/HTML 粘贴照旧交给 TipTap。
 * - 拖拽按 `posAtCoords()` 落点插入（拖到哪插哪），粘贴按当前选区插入。
 * - 同一批图片按原顺序落到同一位置：倒序插入，每次插在最前面。
 * - 顺序处理，避免小机器一次解码十几张大图卡死。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { getImageFiles, type TransferLike } from "../../lib/image-files";
import { prepareImageFile } from "../../lib/image";
import { toast } from "../ui/toast";

export type ImageDropNoticeKind = "info" | "success" | "warn" | "error";

export interface ImageDropNotice {
  kind: ImageDropNoticeKind;
  text: string;
}

function transferOf(event: Event): TransferLike | null {
  const carrier = event as Event & {
    dataTransfer?: TransferLike;
    clipboardData?: TransferLike;
  };
  return carrier.clipboardData ?? carrier.dataTransfer ?? null;
}

function isInside(node: Node | null, root: HTMLElement | null): boolean {
  return Boolean(root && node && (node === root || root.contains(node)));
}

export function useImageDrop(editor: Editor | null) {
  const [notice, setNotice] = useState<ImageDropNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const busyRef = useRef(false);
  const noticeTimerRef = useRef<number | null>(null);

  const showNotice = useCallback((next: ImageDropNotice, ttl = 5200) => {
    setNotice(next);
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => {
      noticeTimerRef.current = null;
      setNotice(null);
    }, ttl);
  }, []);

  const clearNotice = useCallback(() => {
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = null;
    setNotice(null);
  }, []);

  const run = useCallback(
    async (files: File[], position: { from: number; to: number } | null) => {
      const ed = editor;
      if (!ed || files.length === 0) return;
      if (busyRef.current) {
        showNotice({ kind: "info", text: "上一批图片还在处理，请稍候…" }, 2200);
        return;
      }

      busyRef.current = true;
      setBusy(true);
      showNotice({
        kind: "info",
        text: files.length > 1 ? `正在处理 ${files.length} 张图片…` : "正在处理图片…",
      }, 60_000);

      let start = position?.from ?? null;
      if (position && position.from !== position.to) {
        ed.chain().focus().deleteRange({ from: position.from, to: position.to }).run();
      }

      const order = position ? [...files].reverse() : files;
      const done: string[] = [];
      const failed: string[] = [];
      let savedBytes = 0;

      for (const file of order) {
        try {
          const prepared = await prepareImageFile(file);
          if (!prepared) throw new Error("不是可识别的图片");
          const attrs = {
            src: prepared.src,
            alt: prepared.name,
            width: prepared.width,
            height: prepared.height,
          };
          const chain = ed.chain().focus();
          if (start !== null) chain.setTextSelection(start);
          const inserted = chain.setImage(attrs).run();
          if (!inserted) throw new Error("当前位置不能插入图片");
          savedBytes += Math.max(0, prepared.originalBytes - prepared.bytes);
          done.push(prepared.name);
        } catch (error) {
          failed.push(`${file.name}：${error instanceof Error ? error.message : "处理失败"}`);
        }
      }

      busyRef.current = false;
      setBusy(false);

      if (!done.length) {
        showNotice(
          {
            kind: "error",
            text: failed.length ? `图片未能插入 —— ${failed.join("；")}` : "没有可插入的图片",
          },
          8000,
        );
        if (failed.length) toast("error", failed[0]);
        return;
      }

      if (failed.length) {
        showNotice(
          {
            kind: "warn",
            text: `已插入 ${done.length} 张；${failed.length} 张失败 —— ${failed.join("；")}`,
          },
          8000,
        );
        return;
      }

      const sizeNote =
        savedBytes > 200 * 1024 ? `，已压缩约 ${(savedBytes / 1024 / 1024).toFixed(1)} MB` : "";
      showNotice({ kind: "success", text: `已插入 ${done.length} 张图片${sizeNote}` }, 3200);
    },
    [editor, showNotice],
  );

  useEffect(() => {
    if (!editor) return;
    const root = editor.view.dom;

    const onPaste = (event: ClipboardEvent) => {
      if (!isInside(event.target as Node | null, root)) return;
      const files = getImageFiles(transferOf(event));
      if (files.length === 0) return;
      event.preventDefault();
      const { from, to } = editor.state.selection;
      void run(files, { from, to });
    };

    const onDragOver = (event: DragEvent) => {
      if (!isInside(event.target as Node | null, root)) return;
      const data = event.dataTransfer;
      const types = data ? Array.from(data.types ?? []) : [];
      if (!types.includes("Files")) return;
      event.preventDefault();
      if (!busyRef.current) setDragging(true);
    };

    const onDragLeave = (event: DragEvent) => {
      const related = event.relatedTarget as Node | null;
      if (related && (related === root || root.contains(related))) return;
      setDragging(false);
    };

    const onDrop = (event: DragEvent) => {
      setDragging(false);
      if (!isInside(event.target as Node | null, root)) return;
      const files = getImageFiles(transferOf(event));
      if (files.length === 0) return;
      event.preventDefault();
      const coords = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
      const position = coords
        ? { from: coords.pos, to: coords.pos }
        : { from: editor.state.selection.from, to: editor.state.selection.from };
      void run(files, position);
    };

    const onDragEnd = () => setDragging(false);

    document.addEventListener("paste", onPaste, true);
    document.addEventListener("dragover", onDragOver, true);
    document.addEventListener("dragleave", onDragLeave, true);
    document.addEventListener("drop", onDrop, true);
    window.addEventListener("dragend", onDragEnd);
    return () => {
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("dragover", onDragOver, true);
      document.removeEventListener("dragleave", onDragLeave, true);
      document.removeEventListener("drop", onDrop, true);
      window.removeEventListener("dragend", onDragEnd);
    };
  }, [editor, run]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  return { notice, clearNotice, busy, dragging };
}
