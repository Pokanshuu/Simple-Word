/** 内容区用户色卡（界面保持无色，色彩只属于内容） */
export const DEFAULT_PALETTE = [
  "#2b2b2b",
  "#6e6a63",
  "#a5a098",
  "#b36651",
  "#c68d44",
  "#7a7a45",
  "#4a7c59",
  "#3e6c8c",
  "#5c6a8a",
  "#6b5ca5",
  "#8c5a7a",
  "#a05363",
  "#d2b48c",
  "#5c8a72",
  "#8a7d3c",
  "#4a5d52",
];

export function isValidHex(color: string): boolean {
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(color);
}
