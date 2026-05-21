# 前端重构说明

## 当前方向

前端已从传统控制台布局重构为音乐产品体验：

- 主页面是一台极简唱片机，负责播放。
- 音乐库从页面右侧以实体唱片抽屉形式拉出。
- 抽屉内展示歌曲唱片，并提供 `收集 / 入库 / 设置` 入口。
- 收集、入库、设置是独立功能页，保留原有业务能力。

## 页面结构

```text
App
├─ TurntablePage
│  ├─ 唱片机播放器
│  └─ 右侧唱片抽屉
├─ 收集页
│  └─ DownloadPanel
├─ 入库页
│  └─ IngestionPanel
└─ 设置页
   └─ SettingsPanel
```

## 核心文件

- `apps/web/src/App.tsx`：认证、数据加载、全局状态、页面切换和业务动作。
- `apps/web/src/components/TurntablePage.tsx`：唱片机播放器、右侧唱片抽屉、音乐库搜索和歌曲播放入口。
- `apps/web/src/components/DownloadPanel.tsx`：收集/下载页面。
- `apps/web/src/components/IngestionPanel.tsx`：入库记录页面。
- `apps/web/src/components/SettingsPanel.tsx`：设置页面。
- `apps/web/src/components/playerTypes.ts`：播放队列共享前端类型。
- `apps/web/src/styles.css`：当前前端视觉系统和响应式样式。

## 已移除旧结构

- 旧 tab 控制台导航。
- 旧 overview 指标区。
- 旧 `LibraryPanel`。
- 旧底部 `PlayerBar`。
- 旧 Navidrome 列表样式。

## 后续验收重点

1. 唱片抽屉点击和拖动是否顺手。
2. 无歌曲、无封面、长标题、长专辑名是否正常显示。
3. 播放、暂停、上一首、下一首、进度条是否稳定。
4. 收集页下载任务状态是否清晰。
5. 入库页未匹配记录是否足够醒目。
6. 设置页保存、Cookie、密码、诊断功能是否完整。
7. 移动端右侧抽屉是否遮挡或挤压主要内容。

## 验证命令

```powershell
pnpm --filter @myusic/web typecheck
pnpm --filter @myusic/web build
```

