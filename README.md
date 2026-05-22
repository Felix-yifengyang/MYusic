# MYusic

一个自用的个人音乐收集和播放系统。

当前形态是本地 Web 控制台：在浏览器里完成链接下载、音乐列表、入库记录、播放、Cookie 管理、用户登录和设置管理。当前主存储已经切到 Postgres，后续目标是部署到云端，让电脑和手机都连接同一个服务。

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

## 配置

复制 `.env.example` 为 `.env`，按需要修改。当前推荐使用 Postgres：

```env
MYUSIC_STORAGE=postgres
DATABASE_URL=postgres://myusic:your_password@127.0.0.1:5432/myusic
MYUSIC_DATA_DIR=D:\project\MYusic-data
MYUSIC_API_PORT=8787
MYUSIC_NAVIDROME_PORT=4533
MYUSIC_NAVIDROME_URL=http://127.0.0.1:4533
MYUSIC_AUTH_ENABLED=true
```

## 启动

```powershell
cd D:\project\MYusic
pnpm install
pnpm setup
pnpm start
```

打开：

```text
http://127.0.0.1:8787
```

开发前端时可以单独运行：
```powershell
pnpm dev:web
```

`dev:web` 只启动前端页面，登录、下载、设置等功能仍然需要后端 API。先在另一个终端运行完整服务，再打开前端开发地址：
```powershell
pnpm start
pnpm dev:web
```

前端开发服务器会把 `/api` 转发到 `http://127.0.0.1:8787`。如果后端端口不同，设置：
```powershell
$env:MYUSIC_API_PROXY_TARGET="http://127.0.0.1:你的端口"
pnpm dev:web
```

## 生产启动

```powershell
pnpm build
pnpm start:prod
```

`pnpm start` 会先构建再启动，适合本地验证；`pnpm start:prod` 不会重复构建，适合后续交给 pm2、systemd 或 Docker 托管。

## 数据位置

默认运行数据目录：

```text
D:\project\MYusic-data
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
- Bilibili Cookie 可以在设置页上传、粘贴、查看状态或清空。

## JSON 数据迁移到 Postgres

```powershell
pnpm migrate:json-to-postgres
```

迁移脚本只做 upsert，不会删除数据库中已有的新数据。

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
- 设置页可以修改当前用户密码。
- 设置页可以退出所有设备。
- 云端 HTTPS 部署时应设置 `MYUSIC_AUTH_SECURE_COOKIE=true`。

## 云端部署前提

第一阶段云端仍然保留 Navidrome：

- Web 控制台负责产品体验、下载入口、记录管理和内嵌播放。
- API 负责调用 yt-dlp、读写 Postgres、调用 Navidrome API。
- Navidrome 负责音乐库扫描、封面、播放流和 Subsonic 兼容能力。

上云前必须补齐：

- 反向代理配置，例如把公网域名转发到 API 端口。
- 服务器磁盘目录规划，至少包含 music library、cookies、Navidrome data。
- Bilibili Cookie 需要从本机浏览器导出后上传到服务器。

详细部署说明：

- [部署说明](docs/user/deploy.html)

## 常用检查

```powershell
pnpm typecheck
pnpm build
```

