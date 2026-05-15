# Personal Music Stack

一个自用的个人音乐收集和播放系统。

当前形态是本地 Web 控制台：在浏览器里完成链接下载、音乐列表、入库记录、播放和设置管理。当前主存储已经切到 Postgres，后续目标是部署到云端，让电脑和手机都连接同一个云端服务。

## 核心链路

```text
网页链接
-> API 调用 yt-dlp + ffmpeg 下载音频
-> 音频进入音乐目录
-> Navidrome 扫描音乐库
-> Web 控制台播放 / iPhone 使用 Amperfy 播放
```

## 项目结构

```text
apps/web              React + TypeScript + Rsbuild 前端控制台
packages/api          Fastify + TypeScript API 服务
packages/runtime      本地运行时，负责启动 API + Navidrome
packages/downloader   yt-dlp 参数和输出处理
packages/shared       前后端共享类型
services/navidrome    Navidrome 可执行文件目录
scripts               初始化脚本
bin                   本地工具缓存，不提交 Git
```

## 数据位置

项目代码：

```text
D:\project\personal-music-stack
```

运行数据：

```text
D:\project\personal-music-stack-data
├── config\api.json
├── collector\jobs.json
├── collector\ingestions.json
├── cookies\bilibili.txt
├── library
└── navidrome
```

说明：

- `library` 保存下载后的音乐文件。
- 当前主数据存储是 Postgres。
- `collector\jobs.json` 和 `collector\ingestions.json` 是旧 JSON 存储，可作为迁移来源或备份。
- `.env` 保存本地运行配置，不提交 Git。

## 安装

```powershell
cd D:\project\personal-music-stack
pnpm install
pnpm setup
```

初始化脚本会准备：

```text
bin\yt-dlp.exe
bin\ffmpeg.exe
services\navidrome\navidrome.exe
D:\project\personal-music-stack-data
```

## 配置

复制 `.env.example` 为 `.env`，按需要修改。

当前推荐使用 Postgres：

```env
PERSONAL_MUSIC_STORAGE=postgres
DATABASE_URL=postgres://MYusic:dtwxjzh123@127.0.0.1:5432/MYusic
PERSONAL_MUSIC_DATA_DIR=D:\project\personal-music-stack-data
```

如需临时回到 JSON 本地文件：

```env
PERSONAL_MUSIC_STORAGE=json
```

## JSON 数据迁移到 Postgres

```powershell
cd D:\project\personal-music-stack
pnpm migrate:json-to-postgres
```

迁移来源默认是：

```text
D:\project\personal-music-stack-data\collector\jobs.json
D:\project\personal-music-stack-data\collector\ingestions.json
```

迁移目标是 Postgres 中的：

```text
download_jobs
ingestions
```

迁移脚本只做 upsert，不会删除数据库中已有的新数据。

## 启动

```powershell
cd D:\project\personal-music-stack
pnpm start
```

打开：

```text
http://127.0.0.1:8787
```

Navidrome 服务默认地址：

```text
http://127.0.0.1:4533
```

## 常用检查

```powershell
pnpm typecheck
pnpm build
```

设置页的环境检查会显示当前存储模式、Postgres 连接状态，以及 `download_jobs` / `ingestions` 的记录数。
