import type { Editor } from "@tiptap/react";

export interface Match {
  from: number;
  to: number;
}

/**
 * 在文档的**当前状态**里查找所有匹配。
 *
 * 旧版把 matches 缓存在 state 里，替换后文档位置全变，索引还指向旧数组，
 * 于是"替换"会改错位置。现在每次都按当前 doc 重算，只存位置。
 */
export function findMatches(
  doc: { descendants: (cb: (node: unknown, pos: number) => boolean) => void },
  query: string,
  caseSensitive: boolean,
): Match[] {
  const matches: Match[] = [];
  if (!query) return matches;
  const needle = caseSensitive ? query : query.toLowerCase();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (doc as any).descendants((node: any, pos: number) => {
    if (!node?.isText) return true;
    const text: string = node.text ?? "";
    const hay = caseSensitive ? text : text.toLowerCase();
    let idx = hay.indexOf(needle);
    while (idx !== -1) {
      matches.push({ from: pos + idx, to: pos + idx + query.length });
      idx = hay.indexOf(needle, idx + needle.length);
    }
    return true;
  });
  return matches;
}

export function nextMatchIndex(matches: Match[], fromPos: number): number {
  if (!matches.length) return -1;
  for (let i = 0; i < matches.length; i++) {
    if (matches[i].from >= fromPos) return i;
  }
  return 0;
}

export function selectMatch(editor: Editor, match: Match): void {
  editor.chain().focus().setTextSelection({ from: match.from, to: match.to }).run();
  editor.commands.scrollIntoView();
}

/**
 * 替换当前匹配：保留匹配处的字符样式（加粗/颜色等），替换后光标落在替换文本末尾。
 */
export function replaceMatch(editor: Editor, match: Match, replacement: string): boolean {
  if (!match) return false;
  const marks = editor.state.doc.resolve(match.from).marks();
  const tr = editor.state.tr.insertText(replacement, match.from, match.to);
  if (marks.length) tr.ensureMarks(marks);
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

/**
 * 全部替换：**单事务**完成。旧版逐个 replaceMatch（每次一个事务），
 * 撤销要按 N 次，而且每次都要重新找位置。
 */
export function replaceAllMatches(
  editor: Editor,
  query: string,
  caseSensitive: boolean,
  replacement: string,
): number {
  const matches = findMatches(editor.state.doc, query, caseSensitive);
  if (!matches.length) return 0;
  const tr = editor.state.tr;
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    tr.insertText(replacement, matches[i].from, matches[i].to);
  }
  editor.view.dispatch(tr);
  editor.commands.focus();
  return matches.length;
}
