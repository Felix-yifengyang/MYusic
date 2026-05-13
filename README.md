# Personal Music Stack

一个自用的个人音乐收集和播放服务。

当前产品形态是本地 Web 控制台，不是桌面 App。启动后在浏览器打开一个页面，集中管理下载、音乐列表和设置。

```text
网页链接
-> API 调用 yt-dlp + ffmpeg 下载音频
-> 音频进入 D:\project\personal-music-stack-data\library
-> Navidrome 扫描音乐库
-> iPhone 用 Amperfy 连接 Navidrome 播放
```

## 技术栈

```text
apps/web              React + TypeScript + Rsbuild
packages/api          Fastify + TypeScript
packages/runtime      本机运行时，负责启动 API + Navidrome
packages/downloader   yt-dlp 参数和输出处理
packages/shared       前后端共享类型
services/navidrome    Navidrome 可执行文件目录
bin                   yt-dlp / ffmpeg，本机缓存，不提交
scripts               初始化脚本
```

## 目录结构

```text
D:\project\personal-music-stack
├─ apps
│  └─ web
├─ packages
│  ├─ api
│  ├─ downloader
│  ├─ runtime
│  └─ shared
├─ services
│  └─ navidrome
├─ bin
│  ├─ yt-dlp.exe
│  └─ ffmpeg.exe
├─ scripts
│  └─ setup-windows.ps1
├─ package.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ README.md
└─ TODO.md

D:\project\personal-music-stack-data
├─ config
│  └─ api.json
├─ collector
│  └─ jobs.json
├─ library
├─ navidrome
└─ cookies
   └─ bilibili.txt
```

## 首次安装

```powershell
cd D:\project\personal-music-stack
pnpm install
.\scripts\setup-windows.ps1
```

脚本会准备：

```text
bin\yt-dlp.exe
bin\ffmpeg.exe
services\navidrome\navidrome.exe
D:\project\personal-music-stack-data
```

这些二进制、cookie、运行时数据都不会提交到 Git。

## 启动

```powershell
cd D:\project\personal-music-stack
pnpm start
```

启动后打开：

```text
http://127.0.0.1:8787
```

这个页面包含：

- 下载：粘贴 Bilibili、YouTube 或其他 yt-dlp 支持的网站链接。
- 下载任务：支持持久化、取消、重试、清空已结束任务，并记录最终入库文件和源站 metadata。
- 音乐列表：只通过 Navidrome/Subsonic API 搜索和播放，页面内置底部播放器。
- 设置：查看音乐目录、cookie 状态、工具路径、局域网地址。

停止服务：

```text
在启动服务的 PowerShell 窗口按 Ctrl + C
```

## 常用命令

```powershell
pnpm build
pnpm typecheck
pnpm --filter @personal-music/web build
pnpm --filter @personal-music/api build
```

## Bilibili Cookie

如果 Bilibili 下载出现 `HTTP Error 412`，需要导出登录后的 cookies.txt，并保存为：

```text
D:\project\personal-music-stack-data\cookies\bilibili.txt
```

启动器会自动把这个路径写入运行时配置。下载 Bilibili 链接时，只要文件存在，就会自动给 yt-dlp 添加：

```text
--cookies D:\project\personal-music-stack-data\cookies\bilibili.txt
```

## iPhone

iPhone 端使用 Amperfy 连接 Navidrome。

在本地 Web 控制台的“设置”里查看电脑的局域网 IP，然后在 Amperfy 里填写：

```text
http://电脑局域网IP:4533
```

例如：

```text
http://172.20.10.5:4533
```

## Navidrome 集成

Web 控制台不会用 iframe 嵌入 Navidrome 页面，而是通过 Subsonic API 调用 Navidrome 能力。

在设置页填写：

```text
Navidrome 地址
Navidrome 用户名
Navidrome 密码
```

之后可以在“音乐列表”页直接搜索 Navidrome 音乐库，并在当前页面播放。底层使用的接口包括 `ping`、`search3`、`getRandomSongs`、`stream` 和 `getCoverArt`。

Web 控制台不再自己扫描本地音乐目录。下载后的文件仍然进入本地 `library` 目录，但音乐列表、封面和播放都以 Navidrome 扫描结果为准。

## 入库记录

每个新下载任务完成后，会记录一份最小入库信息：

```text
sourceUrl
sourceSite
sourceId
title
uploader
duration
outputPath
relativeOutputPath
infoJsonPath
librarySync
```

这些信息当前保存在 `D:\project\personal-music-stack-data\collector\jobs.json`，后续迁移数据库时会成为核心表结构的基础。

## 数据目录

默认数据目录在 D 盘：

```text
D:\project\personal-music-stack-data
```

如需临时覆盖：

```powershell
$env:PERSONAL_MUSIC_DATA_DIR = "D:\PersonalMusicData"
pnpm start
```

## 云端方向

当前版本先验证本机核心链路。后续部署到云端时，API 和 Navidrome 可以放到服务器上，电脑和手机都只访问云端 Web 控制台和 Navidrome 服务。
