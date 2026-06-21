# Slash 菜单重构设计

**日期**: 2026-06-21  
**状态**: 已确认

## 1. 问题与目标

当前 Slash 菜单（`/` 触发的快捷命令弹出框）是纯搜索式的扁平列表，分为"命令"和"技能"两个段落。用户必须知道命令/技能的关键字才能使用，对初级用户门槛较高。

**目标**：重构为支持分类标签页浏览的菜单，降低新手使用门槛，同时保留关键字搜索能力。

## 2. 布局方案

采用 **左侧分类导航 + 右侧内容区** 布局（类似 macOS 系统设置）。

```
┌─────────────────────────────────────┐
│  [/ comp|                    ]  ← 输入框即搜索    │
├──────┬──────────────────────────────┤
│ 📋全部│ ⚡ 命令 — 2项                │
│      │  / compact    压缩当前会话     │
│ ⚡命令│  / goal       设定目标...     │
│      │                              │
│ 🧩技能│ 🧩 技能 — 匹配 3项           │
│      │  skill:blog-writer  写博客    │
│      │  skill:web-fetch   搜索网页   │
│      │  skill:my-custom  自定义技能  │
│      │                              │
│      │  ↑↓选择 ↩确认 Esc关闭 ⌘1-3切换 │
└──────┴──────────────────────────────┘
```

- 左侧分类导航宽度固定约 80px
- 菜单整体宽度固定，不超过输入框宽度
- 无独立搜索框 — 输入框中的 `/` 及其后文本即实时过滤
- 右下角显示键盘快捷键提示

## 3. 分类定义

三个固定 Tab：

| Tab | 内容 |
|-----|------|
| 📋 全部 | 命令组 + 技能组（按类型分组展示），空组隐藏 |
| ⚡ 命令 | 内置命令：`/compact`、`/goal` |
| 🧩 技能 | 所有已启用的技能（`skill:xxx`），按 SkillType 显示标签 |

## 4. 交互行为

### 打开与关闭

| 触发条件 | 行为 |
|----------|------|
| 输入 `/`（行首或空格后） | 弹出菜单，选中记住的 Tab（默认「全部」） |
| 点击菜单外部 | 关闭菜单 |
| Esc | 关闭菜单 |

### 过滤与选择

| 操作 | 行为 |
|------|------|
| 继续输入文字 | 实时按名称+描述过滤当前 Tab 下的条目 |
| 点击左侧 Tab | 切换分类，选中项重置为第一个 |
| ↑↓ | 在条目列表中移动高亮 |
| Enter | 选中高亮条目，插入对应命令文本并关闭菜单 |
| ⌘1/2/3 | 快速切换到第 1/2/3 个 Tab |

### 条目展示

每个条目显示：图标 + 名称 + 描述（截断）+ 类型标签（技能Tab下）。

类型标签颜色方案契合主题（使用 design token）：
- 内置 → `text-accent`
- MCP → `text-primary`
- 自定义 → `text-success`
- Agent → `text-warning`

## 5. 状态持久化

- 上次选择的 Tab 通过 `localStorage` 记住
- 下次打开菜单时恢复上次 Tab

## 6. 实现计划

### 文件变更

| 文件 | 变更 |
|------|------|
| `src/renderer/components/ChatInput.tsx` | 抽取 SlashMenu 逻辑为独立组件，删减约 150 行 |
| `src/renderer/components/SlashMenu.tsx` | **新建**，独立的 SlashMenu 组件 |
| `src/renderer/slash-commands.ts` | 保持不变（类型定义无需改动） |
| `src/renderer/i18n/locales/zh.json` | 新增 Tab 标签、快捷键提示等 i18n 字符串 |
| `src/renderer/i18n/locales/en.json` | 同上 |
| `src/tests/renderer/slash-menu-classes.test.ts` | 更新测试以匹配新组件 |

### SlashMenu 组件 Props

```typescript
interface SlashMenuProps {
  filter: string;           // 来自输入框的过滤文本
  skills: Skill[];          // 已启用的技能列表
  selectedIndex: number;    // 当前高亮条目索引
  onSelect: (item: SlashItem) => void;
  onClose: () => void;
}
```

### 数据流

```
ChatInput (状态宿主)
  ├── textarea onChange → 检测 / 触发 → setShowSlashMenu(true)
  ├── textarea onChange → 更新 slashFilter
  ├── showSlashMenu && <SlashMenu>
  │     ├── filter → 按当前 Tab 过滤 → 渲染条目
  │     ├── Tab 点击 → setActiveTab → 重新过滤
  │     ├── 条目点击/Enter → onSelect(item) → ChatInput 插入文本
  │     └── Esc/外部点击 → onClose()
  └── keyboard handler (↑↓ Enter Esc ⌘1-3)
```

### 组件结构

```
SlashMenu
├── 左侧 Tab 栏（全部/命令/技能）
└── 右侧内容区
    ├── [全部模式] 分组标题 → 条目列表（每组带计数）
    ├── [命令模式] 条目列表
    └── [技能模式] 条目列表（带类型标签）
```

## 6. 边界情况

### 空状态

| 场景 | 行为 |
|------|------|
| 过滤无匹配 | 显示"无匹配结果"提示 |
| 命令 Tab 无内容 | 不隐藏（内置命令始终存在） |
| 技能 Tab 无已启用技能 | 隐藏「技能」Tab；若当前在技能 Tab 则自动切回「全部」 |
| 「全部」Tab 下某分组为空 | 隐藏该分组标题及区域 |
| 输入框删除 `/` | 关闭菜单 |

### IME 组合输入

保留现有逻辑：组合输入期间用 `selectionEnd` 获取实际文本进行过滤；组合结束后由 `onChange` 触发正常过滤。

### ⌘ 快捷键跨平台

`⌘1-3`（macOS Command）在 Windows 上对应 `Ctrl+1-3`，使用 Electron accelerator 自动适配。

## 7. 非功能需求

- 菜单打开延迟 < 100ms
- 过滤响应 < 16ms（60fps）
- 支持键盘完全操作
- 兼容现有主题方案（使用 CSS 变量/design token）
- 不破坏现有的 `/compact` 直接发送的快捷行为
