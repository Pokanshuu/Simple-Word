# Simple Word

Simple Office 套件的第一款产品 —— 一个基于 **Tauri 2 + React 19 + Vite + TipTap 3 + Tailwind 4** 的文档编辑器，桌面与 Web 双端共用同一前端。

> 设计遵循 OC Studio 设计系统（寂静工作台）：界面绝对寂静，色彩只属于内容。

## 技术栈

| 分层 | 技术 | 版本 | 用途 |
|---|---|---|---|
| 桌面壳 | Tauri（Rust 1.95） | 2.11.5 | 桌面应用打包、原生能力 |
| 桌面插件 | `@tauri-apps/plugin-dialog` / `plugin-fs` / `plugin-clipboard-manager` / `plugin-opener` | 2.x | 文件对话框、读写文件、剪贴板 |
| 构建 | Vite + `@vitejs/plugin-react` | 8.2.2 | 开发服务器与生产构建 |
| 语言 | TypeScript | 6.0.3 | 全量类型检查（`tsc` 门禁） |
| UI 框架 | React + React DOM | 19.2.8 | 前端渲染 |
| 路由 | 自研 hash 轻量路由（`src/lib/router.ts`） | — | 首页 ↔ 编辑器切换 |
| 编辑器内核 | TipTap（`@tiptap/react` / `starter-kit` / `pm` / `suggestion` + 表格、任务清单、图片、颜色、对齐、占位等扩展） | 3.31.3 | ProseMirror 文档模型与编辑能力 |
| 样式 | Tailwind CSS + `@tailwindcss/vite` | 4.3.3 | 设计令牌（`@theme inline` + CSS 变量）与原子样式 |
| 组件工具 | `clsx` + `tailwind-merge` | 2.1.1 / 3.6.0 | 类名组合（`cn()`） |
| 图标 | `lucide-react`（`strokeWidth=2`） | 1.41.0 | 全站唯一图标来源 |
| 本地存储 | Dexie（IndexedDB） | 4.4.5 | 最近文档、草稿镜像、文件句柄、设置 |
| docx 导入 | mammoth（浏览器构建，动态加载） | 1.12.2 | `.docx` → HTML → ProseMirror JSON |
| docx 导出 | docx | 9.7.1 | ProseMirror JSON → OOXML（含编号、页面设置） |
| 运行时 | Node.js | 24.15 | 依赖管理与构建 |

**双端存储策略**：桌面走 Tauri `dialog` + `fs` 插件；Web 走 File System Access API，不支持时回退到 `<input type="file">` + 下载。运行时通过 `isTauri()` 探测，Tauri 模块全部动态 `import`，因此 Web 包不依赖桌面能力。

**依赖清单**：完整版本以 `package.json` 为准；Rust 侧依赖见 `src-tauri/Cargo.toml`。

## 功能

- 文档管理：新建 / 打开 / 保存 / 另存为，首页最近文档列表（含草稿标记与搜索）
- 编辑：标题、加粗/斜体/下划线/删除线、文字颜色色卡、对齐、列表（含任务清单）、引用、代码块、表格、内联图片、链接
- 图片：本地选择 / 粘贴 / 拖拽插入；自动压缩到最长边 1600px 并记录宽高，不再把 8MB 原图直接塞进 `.sowd`
- 效率：斜杠命令（`/`，支持方向键 + Enter）、选词气泡菜单、查找替换（单事务全替换）、快捷键（`Ctrl+S/P/F/K`、`Ctrl+Shift+S` 等）
- 存储：自有 `.sowd` 格式；自动保存（防抖 1.2s）；新建文档草稿跨重启恢复；文件文档保存成功后清理草稿镜像
- 互通：`.docx` 导入（mammoth，修复空节点/嵌套表格/行内代码/图片压缩）与导出（docx 库，图片按正文宽度等比缩放）、打印 / 导出 PDF
- 安全：docx / 粘贴链接走 `http(s)/mailto/tel` 白名单；打开旧文件时清洗未知节点、空文本与非法 URL
- 界面：暖白极简工作台、衬线正文、按宽度折叠的格式工具栏、暗黑模式、页面缩放、页面设置、大纲面板、字数统计

## 开发

```bash
npm install          # 安装依赖
npm run dev          # Web 开发（localhost:1420）
npm run tauri dev    # 桌面开发
npm run build        # 类型检查 + 生产构建
npm run tauri build  # 打包桌面应用
```

## 结构

```
src/
  lib/           # sowd 格式、双端存储适配、docx 互转、查找、路由、Dexie
  hooks/         # useDocument（核心：加载/编辑/自动保存）、useTheme、useRecents
  components/
    home/        # 首页（最近文档）
    editor/      # 编辑器：顶栏、格式工具、气泡菜单、斜杠面板、查找替换、状态栏、大纲
    ui/          # 设计系统原子组件（按钮/弹窗/下拉/Toast…）
  styles/        # OC Studio 设计令牌（亮/暗）与纸张排版样式
src-tauri/       # Tauri 壳（dialog/fs/clipboard 插件）
docs/PRD.md      # 产品需求文档
```

## 文件格式

`.sowd` = JSON（`meta` / `settings.page` / `content`(ProseMirror JSON) / `styles.palette`），见 `docs/PRD.md` 第 6 节。
