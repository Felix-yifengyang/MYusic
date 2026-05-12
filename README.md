# Personal Music Stack

一个自用的集成式音乐收集和播放产品。

从用户角度看，它是一个整体：

```text
启动产品
→ 粘贴网页链接下载音频
→ Navidrome 自动读取音乐库
→ iPhone 用 Amperfy 播放
```

内部组件：

```text
collector  = 网页下载入口，调用 yt-dlp + ffmpeg
Navidrome  = 音乐库服务
Amperfy    = iOS 播放器
yt-dlp     = 网站音频下载
ffmpeg     = 抽音频、转码、封面和元数据
```

## 目录结构

```text
D:\project\personal-music-stack
├─ app
│  ├─ electron-main.js
│  ├─ launcher.js
│  ├─ loading.html
│  └─ runtime.js
├─ bin
│  ├─ node.exe
│  ├─ yt-dlp.exe
│  └─ ffmpeg.exe
├─ services
│  ├─ collector
│  └─ navidrome
├─ package.json
└─ README.md

D:\project\personal-music-stack-data
├─ library
├─ navidrome
├─ cookies
│  └─ bilibili.txt
└─ app.log
```

## 桌面 App

首次 clone 后先运行 Windows setup：

```powershell
cd D:\project\personal-music-stack
.\scripts\setup-windows.ps1
```

这个脚本会准备：

```text
bin\node.exe
bin\yt-dlp.exe
bin\ffmpeg.exe
services\navidrome\navidrome.exe
services\collector\config.json
D:\project\personal-music-stack-data
```

开发阶段启动 Electron 桌面窗口：

```powershell
cd D:\project\personal-music-stack
pnpm app
```

它会自动启动本地 collector 和 Navidrome，然后加载下载页面。

## 打包

生成 Windows unpacked 目录版：

```powershell
cd D:\project\personal-music-stack
pnpm dist
```

推荐使用的可运行产物：

```text
D:\project\personal-music-stack\release\win-unpacked\Personal Music.exe
```

当前自动化验证通过的是 `win-unpacked\Personal Music.exe`。

## 内置工具

当前包已内置：

```text
bin\node.exe
bin\yt-dlp.exe
bin\ffmpeg.exe
```

运行时会优先使用这些内置工具。

本地运行需要准备这些二进制文件，但它们不会提交到 Git：

```text
bin\node.exe
bin\yt-dlp.exe
bin\ffmpeg.exe
services\navidrome\navidrome.exe
```

collector 的真实配置文件是：

```text
services\collector\config.json
```

它由本地运行时同步生成，不提交到 Git。仓库里只保留：

```text
services\collector\config.example.json
```

## 命令行启动

不打开桌面窗口，只启动本地服务：

```powershell
cd D:\project\personal-music-stack
pnpm start
```

启动后访问：

```text
collector:  http://127.0.0.1:8787
Navidrome:  http://127.0.0.1:4533
```

按 `Ctrl + C` 停止由启动器拉起的服务。

## 数据目录

默认数据目录在 D 盘：

```text
D:\project\personal-music-stack-data
```

其中音乐库是：

```text
D:\project\personal-music-stack-data\library
```

collector 的下载目录和 Navidrome 的扫描目录都会在启动时自动指向这个目录。

## Bilibili Cookie

Bilibili 出现 `HTTP Error 412` 时，需要给 yt-dlp 提供登录 Cookie。

把浏览器导出的 cookies.txt 保存为：

```text
D:\project\personal-music-stack-data\cookies\bilibili.txt
```

App 启动时会自动把这个路径写入 collector 配置。下载 Bilibili 链接时，如果这个文件存在，会自动添加：

```text
--cookies D:\project\personal-music-stack-data\cookies\bilibili.txt
```

如需临时覆盖数据目录，可以设置环境变量：

```powershell
$env:PERSONAL_MUSIC_DATA_DIR = "D:\PersonalMusicData"
```

## iPhone

iPhone 用 Amperfy 连接 Navidrome。服务器地址填电脑在当前网络下的 IP，例如：

```text
http://172.20.10.5:4533
```

## 云端方向

当前版本用于验证本机核心链路。后续部署到云端时，Electron App 可以改成连接云端服务，不再启动本机 collector/Navidrome。
