# Simple Office — Word 产品需求文档 (PRD)

> 版本 v0.1 · 状态：已实现 MVP · 配套规范：OC Studio 设计系统（寂静工作台）

## 1. 背景与愿景

构建一个轻量、快速、美的 office 套件，首款产品为 Word（文档编辑器）。桌面端跑 Tauri 2，同一前端可部署为 Web 版。核心承诺：**界面绝对寂静，色彩只属于内容**（无色的暖灰白 UI + 可自定义的文档内容色）。

## 2. 目标用户与场景

- 写作者/学生：写文章、论文、读书笔记
- 开发者：技术文档、README、博客
- 场景：离线优先的本地编辑、跨设备（桌面/浏览器）继续编辑

## 3. 核心决策

| 决策点 | 结论 |
|---|---|
| 文件格式 | 自有 JSON 格式 `.sowd`（Simple Office Word Document）为主，`.docx` 仅作导入/导出 |
| 产品形态 | Tauri 桌面 + Web 双端，前端完全共用 |
| 技术栈 | React 19 + Vite + TypeScript + TipTap 3 + Tailwind 4 + Tauri 2 + Dexie |
| 本地数据 | Dexie (IndexedDB)：最近文档、自动保存草稿、设置、浏览器文件句柄 |

## 4. 功能需求

### P0（MVP，已实现）
| 编号 | 功能 | 说明 |
|---|---|---|
| W-01 | 文档生命周期 | 新建 / 打开 / 保存 / 另存为 / 关闭；未保存状态指示（灰圈勾=已保存，黄三角=未保存） |
| W-02 | 首页（开始界面） | 最近文档列表（最近 7 天/更早分组）、草稿标记、搜索、从列表移除；新建按钮、docx 导入入口、空态引导 |
| W-03 | 基础编辑 | 标题 H1–H6、正文、加粗/斜体/下划线/删除线、文字颜色（用户色卡）、对齐 |
| W-04 | 结构块 | 有序/无序列表、任务清单、引用、代码块、水平线、表格（增删行列）、图片（本地插入）、链接 |
| W-05 | 撤销/重做 | 完整快捷键体系（Ctrl/Cmd+B/I/U/Z/Y/S/P/F 等） |
| W-06 | 斜杠命令 | 输入 `/` 呼出插入面板（浮层规范） |
| W-07 | 气泡菜单 | 选中文本浮动格式条；表格/图片选中显示专属操作 |
| W-08 | 查找替换 | 顶部浮条，支持区分大小写、逐个/全部替换 |
| W-09 | 自动保存 | 1.2s 防抖写入 `.sowd`；全程镜像草稿至 Dexie，重开时检测草稿比文件新则提示恢复 |
| W-10 | docx 导入/导出 | 导入经 mammoth 解析 → TipTap；导出经 `docx` 库生成 OOXML |
| W-11 | 打印 / PDF | 动态 @page 边距 + A4 分页预览 |
| W-12 | 暗黑模式 | 完整暗黑令牌；纸张在暗色下保持暖白 |
| W-13 | 双端存储 | 桌面：`plugin-dialog` + `plugin-fs`；Web：File System Access API + 下载回退 |
| W-14 | 页面设置 | 纸张大小（A4/Letter）、方向、四周边距（pt） |
| W-15 | 大纲面板 | 从标题生成，点击跳转 |
| W-17 | 字数统计 | 状态栏实时字数/字符数 |
| W-18 | 缩放 | 80–200% 页面缩放 |

### P1（规划中）
- 页眉页脚、页码；目录生成
- 批注（侧边评论区）
- 聚焦模式 / 打字机模式
- 图片浮动（环绕排版）、docx 保真度提升（自定义 OOXML 解析）
- 公式（LaTeX 渲染）

### P2（远期）
- 多人协作（Yjs）、版本历史、模板中心、语音输入

## 5. 信息架构

```
Simple Office
├── Home（首页）
│   ├── 顶栏：Logo、搜索、主题切换、打开、导入 Word、新建文档
│   └── 最近文档列表 + 空态引导
└── Editor（编辑器）
    ├── 顶栏：返回、标题（可重命名）、保存状态、格式工具栏、插入图片/表格、导出、打印、更多（大纲/页面设置/主题）
    ├── 画布：paper 背景居中 A4 白纸（细边+轻阴影，210mm 宽按缩放渲染）
    ├── 右侧面板：大纲（可折叠）
    ├── 浮动层：气泡菜单、斜杠面板、查找替换浮条、链接输入、颜色色卡
    └── 状态栏：字数、字符、保存状态、缩放
```

## 6. 数据模型（.sowd 规范 v1）

```jsonc
{
  "meta": {
    "format": "sowd", "version": 1,
    "title": "文档标题", "createdAt": 0, "updatedAt": 0,
    "app": { "name": "simple-word", "version": "0.1.0" }
  },
  "settings": {
    "page": { "size": "A4", "orientation": "portrait",
               "margin": { "top": 72, "right": 72, "bottom": 72, "left": 72 } } // pt
  },
  "content": {},        // TipTap ProseMirror JSON 文档树
  "styles": { "palette": ["#2b2b2b", …] } // 用户自定义内容色卡
}
```

## 7. 技术架构

```
┌───────────── 共享前端 (React 19 + Vite) ─────────────┐
│  UI 层：设计令牌 → Tailwind4 主题 → 原子组件          │
│  编辑层：TipTap 3 + 自定义扩展（斜杠命令/气泡/快捷键）│
│  服务层：                                          │
│   StorageAdapter（接口）                            │
│   ├─ TauriAdapter：dialog + fs 插件（动态 import）   │
│   └─ WebAdapter：File System Access API / download  │
│   AutosaveService / RecentService / ImportExport    │
│  Dexie：drafts（草稿镜像）、recents、handles、settings│
└──────────────────────────────────────────────────────┘
  isTauri() ? Tauri 运行时（无自定义 command，全用官方插件）
            : 浏览器运行时
```

- docx 导入：`mammoth`（docx→HTML→自研 HTML→ProseMirror 转换器，支持标题/列表/任务/引用/代码/表格/图片/链接/颜色/对齐）
- docx 导出：`docx`（TipTap→OOXML，含编号定义、A4 页面设置、页边距）

## 8. 非功能需求

- 性能：打开 100KB 文档 < 500ms；自动保存防抖 1.2s 不阻塞输入；docx 依赖动态加载
- 数据安全：草稿实时镜像至 Dexie，崩溃恢复不丢字；离开前三重确认（保存/不保存/取消）
- 平台：Windows / macOS / Linux；Web 支持 Chrome/Edge/Safari/Firefox 近两版本
- 界面：全程遵守 OC Studio 设计系统（暖灰白 UI、细线古典、状态色仅三种、浮层统一 portal 到 #overlay-root）

## 9. 里程碑

| 阶段 | 周期 | 状态 |
|---|---|---|
| M1 脚手架 | 3d | ✅ 完成 |
| M2 文件管理（首页/最近/打开/保存/草稿） | 3d | ✅ 完成 |
| M3 编辑功能全量 | 7d | ✅ 完成 |
| M4 docx 互通 + 打印 | 4d | ✅ 完成 |
| M5 打磨发布（打包签名） | 5d | ⏳ 待办 |
