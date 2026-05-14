# TODO

## 当前目标

把项目从“验证型原型”整理成“可维护的本地产品雏形”，再继续云端化。

## 已完成里程碑

- [x] 本地 Web 控制台替代 Electron。
- [x] yt-dlp + ffmpeg 下载链路跑通。
- [x] Navidrome 集成，音乐列表、封面、播放都通过 Navidrome API。
- [x] iPhone 可通过 Amperfy 连接 Navidrome。
- [x] 下载任务持久化。
- [x] 入库记录独立于下载任务。
- [x] 下载完成后自动触发 Navidrome 扫描。
- [x] 入库记录可自动/手动关联 Navidrome song id。
- [x] Bilibili cookies.txt 上传/粘贴管理。
- [x] repository 抽象。
- [x] JSON 本地存储实现。
- [x] Postgres 存储实现。
- [x] `.env` 配置入口。

## 近期优先级

- [ ] 验证 Postgres 模式完整闭环。
- [ ] 增加 JSON -> Postgres 迁移脚本。
- [ ] 继续拆分前端 `App.tsx`。
- [ ] 整理用户可见文案，统一“API / Web 控制台 / 入库记录”等命名。

## 后端整理

- [x] 拆 `routes/jobs.ts`。
- [x] 拆 `routes/ingestions.ts`。
- [x] 拆 `routes/navidrome.ts`。
- [x] 拆 `routes/settings.ts`。
- [x] 抽 `services/download-service.ts`。
- [x] 抽 `services/ingestion-service.ts`。
- [ ] 给 repository 增加最小测试或验证脚本。

## 前端整理

- [x] 拆 `DownloadPanel`。
- [x] 拆 `LibraryPanel`。
- [x] 拆 `IngestionPanel`。
- [x] 拆 `SettingsPanel`。
- [x] 拆 `PlayerBar`。
- [x] 增加 `api/client.ts` 管理请求。

## 云端化

- [ ] 明确云端部署形态：单机服务器 / Docker / PaaS。
- [ ] 设计用户登录和权限。
- [ ] 设计 Cookie 安全存储。
- [ ] 设计云端音乐文件存储：服务器磁盘 / 对象存储。
- [ ] 设计 Navidrome 与云端音乐目录的关系。
- [ ] 增加 HTTPS 和域名配置方案。

## 暂缓

- [ ] 批量下载/播放列表模式。
- [ ] 元数据编辑。
- [ ] 直接从下载任务播放或定位歌曲。
- [ ] 更复杂的播放队列管理。
- [ ] PWA 或原生 iOS app。
