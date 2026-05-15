# 云端部署说明

这份文档描述第一阶段的云端部署模型：一台服务器同时运行 Web/API、Postgres、Navidrome、yt-dlp 和 ffmpeg。音乐文件先保存在服务器磁盘，不引入对象存储和独立云数据库。

## 推荐拓扑

```text
浏览器 / 手机
  |
  | HTTPS
  v
反向代理 Caddy / Nginx
  |-- console.example.com  -> 127.0.0.1:8787  Personal Music Web/API
  `-- music.example.com    -> 127.0.0.1:4533  Navidrome / Amperfy

服务器内部
  |-- Personal Music API
  |-- Navidrome
  |-- PostgreSQL
  `-- /data/personal-music-stack
```

说明：

- Web 控制台只暴露 `console.example.com`。
- Navidrome 建议用独立域名 `music.example.com` 暴露给 Amperfy。
- API 内部调用 Navidrome 仍然用 `http://127.0.0.1:4533`，不依赖公网域名。
- 防火墙只开放 `80` 和 `443`，不要直接开放 `8787` 和 `4533`。

## 服务器目录

建议把代码和运行数据分开：

```text
/opt/personal-music-stack          项目代码
/data/personal-music-stack         运行数据
/data/personal-music-stack/library 音乐文件
/data/personal-music-stack/cookies Cookie 文件
/data/personal-music-stack/navidrome
```

## 依赖

服务器需要准备：

```text
Node.js 18+
pnpm
PostgreSQL
yt-dlp
ffmpeg
Navidrome Linux 可执行文件
Caddy 或 Nginx
```

当前 `pnpm setup` 是 Windows 初始化脚本。Linux 云端第一版需要手动安装 `yt-dlp`、`ffmpeg` 和 Navidrome，后续可以再补 `setup-linux.sh`。

## 云端 .env 示例

```env
PERSONAL_MUSIC_STORAGE=postgres
DATABASE_URL=postgres://personal_music:strong_password@127.0.0.1:5432/personal_music

PERSONAL_MUSIC_DATA_DIR=/data/personal-music-stack
PERSONAL_MUSIC_LIBRARY_DIR=/data/personal-music-stack/library

PERSONAL_MUSIC_API_HOST=127.0.0.1
PERSONAL_MUSIC_API_PORT=8787

PERSONAL_MUSIC_NAVIDROME_HOST=127.0.0.1
PERSONAL_MUSIC_NAVIDROME_PORT=4533
PERSONAL_MUSIC_NAVIDROME_URL=http://127.0.0.1:4533

PERSONAL_MUSIC_AUTH_ENABLED=true
PERSONAL_MUSIC_AUTH_COOKIE=personal_music_session
PERSONAL_MUSIC_AUTH_SESSION_DAYS=30
PERSONAL_MUSIC_AUTH_SECURE_COOKIE=true

PERSONAL_MUSIC_YTDLP_PATH=/usr/local/bin/yt-dlp
PERSONAL_MUSIC_FFMPEG_PATH=/usr/bin/ffmpeg
PERSONAL_MUSIC_BILIBILI_COOKIES=/data/personal-music-stack/cookies/bilibili.txt

PERSONAL_MUSIC_AUDIO_FORMAT=mp3
PERSONAL_MUSIC_AUDIO_QUALITY=0
PERSONAL_MUSIC_MAX_JOBS=50
```

关键点：

- 云端必须启用 `PERSONAL_MUSIC_AUTH_SECURE_COOKIE=true`，否则 HTTPS 下 Cookie 安全性不够。
- `PERSONAL_MUSIC_API_HOST` 和 `PERSONAL_MUSIC_NAVIDROME_HOST` 推荐绑定 `127.0.0.1`，只让反向代理访问。
- `PERSONAL_MUSIC_NAVIDROME_URL` 推荐保持 `http://127.0.0.1:4533`，这是 API 到 Navidrome 的内部地址。

## 启动流程

```bash
cd /opt/personal-music-stack
pnpm install
pnpm build
pnpm start:prod
```

首次打开 `https://console.example.com` 时，如果数据库里还没有用户，会进入创建管理员流程。

## Caddy 示例

```caddyfile
console.example.com {
  reverse_proxy 127.0.0.1:8787
}

music.example.com {
  reverse_proxy 127.0.0.1:4533
}
```

Caddy 会自动申请和续期 HTTPS 证书。

## Nginx 示例

```nginx
server {
  listen 443 ssl http2;
  server_name console.example.com;

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 443 ssl http2;
  server_name music.example.com;

  location / {
    proxy_pass http://127.0.0.1:4533;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Nginx 证书可以用 certbot 管理。

## Amperfy 连接

iOS 端 Amperfy 连接 Navidrome：

```text
Server: https://music.example.com
Username: Navidrome 用户名
Password: Navidrome 密码
```

注意：这是 Navidrome 的账号，不是 Personal Music 控制台的账号。

## Bilibili Cookie

云端没有你的本机 Chrome 登录态，所以 Bilibili Cookie 需要从本机浏览器导出为 Netscape `cookies.txt` 后，在设置页上传或粘贴。

设置页会显示：

- Cookie 文件是否存在
- 文件大小
- 更新时间
- 清空 Cookie

## 上云检查清单

- [ ] `pnpm build` 通过。
- [ ] `.env` 使用云端路径和强密码。
- [ ] Postgres 可连接。
- [ ] `yt-dlp` 可执行。
- [ ] `ffmpeg` 可执行。
- [ ] Navidrome 可以在 `127.0.0.1:4533` 打开。
- [ ] `console.example.com` 可以打开控制台。
- [ ] `music.example.com` 可以打开 Navidrome。
- [ ] HTTPS 生效。
- [ ] `PERSONAL_MUSIC_AUTH_SECURE_COOKIE=true`。
- [ ] 设置页上传 Bilibili Cookie 后状态正常。
- [ ] Amperfy 能连接 `https://music.example.com`。

## 暂不处理

- Docker 镜像。
- systemd / pm2 自动守护配置。
- Linux 一键安装脚本。
- 对象存储。
- 独立云数据库。
