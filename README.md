# Personal Music Stack

一个自用的个人音乐收集和播放系统。

当前形态是本地 Web 控制台：在浏览器里完成链接下载、音乐列表、入库记录、播放和设置管理。当前主存储已经切到 Postgres，后续目标是部署到云端，让电脑和手机都连接同一个服务。

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
|-- config\api.json
|-- collector\jobs.json
|-- collector\ingestions.json
|-- cookies\bilibili.txt
|-- library
`-- navidrome
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
DATABASE_URL=postgres://MYusic:your_password@127.0.0.1:5432/MYusic
PERSONAL_MUSIC_DATA_DIR=D:\project\personal-music-stack-data
```

常用运行配置：

```env
PERSONAL_MUSIC_API_HOST=0.0.0.0
PERSONAL_MUSIC_API_PORT=8787
PERSONAL_MUSIC_NAVIDROME_HOST=0.0.0.0
PERSONAL_MUSIC_NAVIDROME_PORT=4533
PERSONAL_MUSIC_NAVIDROME_URL=http://127.0.0.1:4533
PERSONAL_MUSIC_BILIBILI_COOKIES=D:\project\personal-music-stack-data\cookies\bilibili.txt
PERSONAL_MUSIC_AUDIO_FORMAT=mp3
PERSONAL_MUSIC_AUDIO_QUALITY=0
PERSONAL_MUSIC_MAX_JOBS=50
PERSONAL_MUSIC_AUTH_ENABLED=true
PERSONAL_MUSIC_AUTH_COOKIE=personal_music_session
PERSONAL_MUSIC_AUTH_SESSION_DAYS=30
PERSONAL_MUSIC_AUTH_SECURE_COOKIE=false
```

如果需要临时回到 JSON 本地文件：

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

## 本地启动

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

## 生产启动

先构建：

```powershell
pnpm build
```

再启动已经构建好的运行时：

```powershell
pnpm start:prod
```

`pnpm start` 会先构建再启动，适合本地验证；`pnpm start:prod` 不会重复构建，适合后续交给 pm2、systemd 或 Docker 托管。

## 云端部署前提

第一阶段云端仍然保留 Navidrome：

- Web 控制台负责产品体验、下载入口、记录管理和内嵌播放。
- API 负责调用 yt-dlp、读写 Postgres、调用 Navidrome API。
- Navidrome 负责音乐库扫描、封面、播放流和 Subsonic 兼容能力。

上云前必须补齐：

- cookies 文件上传或同步方案，因为云端没有你的本机 Chrome 登录态。
- 反向代理配置，例如把公网域名转发到 API 端口。
- 服务器磁盘目录规划，至少包含 music library、cookies、Navidrome data。

## 登录鉴权

Postgres 模式下默认启用登录鉴权。首次打开页面时，如果数据库里还没有用户，会进入创建管理员流程。

用户和会话都保存在 Postgres：

```text
users
user_sessions
```

说明：

- 密码不会明文保存，后端使用 `crypto.scrypt` 保存哈希。
- 登录态保存在 HttpOnly Cookie 中。
- 云端 HTTPS 部署时应设置 `PERSONAL_MUSIC_AUTH_SECURE_COOKIE=true`。

## 常用检查

```powershell
pnpm typecheck
pnpm build
```

设置页的环境检查会显示当前存储模式、Postgres 连接状态，以及 `download_jobs` / `ingestions` 的记录数。
