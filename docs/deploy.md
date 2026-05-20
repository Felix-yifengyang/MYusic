# 云端部署说明

这份文档描述第一阶段的云端部署模型：一台服务器同时运行 Web/API、Postgres、Navidrome、yt-dlp 和 ffmpeg。音乐文件先保存在服务器磁盘，不引入对象存储和独立云数据库。

当前更推荐先使用 Docker Compose，见 [Docker Compose 部署](docker-deploy.md)。

## 推荐拓扑

```text
浏览器 / 手机
  |
  | HTTPS
  v
反向代理 Caddy / Nginx
  |-- console.example.com  -> 127.0.0.1:8787  MYusic Web/API
  `-- music.example.com    -> 127.0.0.1:4533  Navidrome / Amperfy

服务器内部
  |-- MYusic API
  |-- Navidrome
  |-- PostgreSQL
  `-- /data/MYusic
```

说明：

- Web 控制台只暴露 `console.example.com`。
- Navidrome 建议用独立域名 `music.example.com` 暴露给 Amperfy。
- API 内部调用 Navidrome 使用容器内地址或本机内网地址，不依赖公网域名。
- 防火墙只开放 `80` 和 `443`；临时验证可以开放 `8787` 和 `4533`。

## 服务器目录

建议把代码和运行数据分开：

```text
/opt/MYusic          项目代码
/data/MYusic         运行数据
/data/MYusic/library 音乐文件
/data/MYusic/cookies Cookie 文件
/data/MYusic/navidrome
```

## 云端 .env 示例

非 Docker 手动部署可参考：

```env
MYUSIC_STORAGE=postgres
DATABASE_URL=postgres://myusic:strong_password@127.0.0.1:5432/myusic

MYUSIC_DATA_DIR=/data/MYusic
MYUSIC_LIBRARY_DIR=/data/MYusic/library

MYUSIC_API_HOST=127.0.0.1
MYUSIC_API_PORT=8787

MYUSIC_NAVIDROME_HOST=127.0.0.1
MYUSIC_NAVIDROME_PORT=4533
MYUSIC_NAVIDROME_URL=http://127.0.0.1:4533

MYUSIC_AUTH_ENABLED=true
MYUSIC_AUTH_COOKIE=myusic_session
MYUSIC_AUTH_SESSION_DAYS=30
MYUSIC_AUTH_SECURE_COOKIE=true

MYUSIC_YTDLP_PATH=/usr/local/bin/yt-dlp
MYUSIC_FFMPEG_PATH=/usr/bin/ffmpeg
MYUSIC_BILIBILI_COOKIES=/data/MYusic/cookies/bilibili.txt

MYUSIC_AUDIO_FORMAT=mp3
MYUSIC_AUDIO_QUALITY=0
MYUSIC_MAX_JOBS=50
```

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

注意：这是 Navidrome 的账号，不是 MYusic 控制台的账号。

## Bilibili Cookie

云端没有你的本机 Chrome 登录态，所以 Bilibili Cookie 需要从本机浏览器导出为 Netscape `cookies.txt` 后，在设置页上传或粘贴。

设置页会显示：

- Cookie 文件是否存在
- 文件大小
- 更新时间
- 清空 Cookie

## 上云检查清单

- [ ] `docker compose up -d --build` 成功。
- [ ] `.env.docker` 使用云端路径和强密码。
- [ ] Postgres 容器 healthy。
- [ ] Navidrome 可以打开。
- [ ] 控制台可以打开。
- [ ] 首次打开控制台可以创建管理员。
- [ ] 设置页上传 Bilibili Cookie 后状态正常。
- [ ] 下载一条音频成功。
- [ ] Navidrome 能扫描到下载后的音乐。
- [ ] Amperfy 能连接 Navidrome。

## 暂不处理

- systemd / pm2 自动守护配置。
- Linux 一键安装脚本。
- 对象存储。
- 独立云数据库。

