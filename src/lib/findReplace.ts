import type { Editor } from "@tiptap/react";

export interface Match {
  from: number;
  to: number;
}

export function findMatches(
  doc: { descendants: (cb: (node: unknown, pos: number) => boolean) => void },
  query: string,
  caseSensitive: boolean,
): Match[] {
  const matches: Match[] = [];
  if (!query) return matches;
  const needle = caseSensitive ? query : query.toLowerCase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc.descendants((node: any, pos: number) => {
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
  return 0; // wrap around
}

export function selectMatch(editor: Editor, match: Match): void {
  editor.chain().focus().setTextSelection({ from: match.from, to: match.to }).run();
  editor.commands.scrollIntoView();
}

export function replaceMatch(editor: Editor, match: Match, replacement: string): void {
  editor.chain().focus().insertContentAt({ from: match.from, to: match.to }, replacement).run();
}

export function replaceAllMatches(
  editor: Editor,
  query: string,
  caseSensitive: boolean,
  replacement: string,
): number {
  const matches = findMatches(editor.state.doc, query, caseSensitive);
  for (let i = matches.length - 1; i >= 0; i--) {
    replaceMatch(editor, matches[i], replacement);
  }
  return matches.length;
}
