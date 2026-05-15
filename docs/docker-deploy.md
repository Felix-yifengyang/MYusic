# Docker Compose 部署

这是当前推荐的云端部署方式。它会启动三个容器：

```text
app        Personal Music Web/API
navidrome  音乐库和 Subsonic 服务
postgres   数据库
```

## 文件

```text
Dockerfile
docker-compose.yml
.env.docker.example
```

## 启动

复制配置：

```bash
cp .env.docker.example .env.docker
```

修改 `.env.docker`：

```env
DATABASE_URL=postgres://personal_music:change_me@postgres:5432/personal_music
PERSONAL_MUSIC_NAVIDROME_URL=http://navidrome:4533
PERSONAL_MUSIC_MANAGED_NAVIDROME=false
```

同时修改 `docker-compose.yml` 里的 Postgres 密码：

```yaml
POSTGRES_PASSWORD: change_me
```

启动：

```bash
docker compose up -d --build
```

查看日志：

```bash
docker compose logs -f app
docker compose logs -f navidrome
docker compose logs -f postgres
```

停止：

```bash
docker compose down
```

## 访问

本机测试：

```text
http://服务器IP:8787
http://服务器IP:4533
```

正式云端建议走反向代理：

```text
https://console.example.com -> app:8787
https://music.example.com   -> navidrome:4533
```

## 重要配置

Docker 模式下 Navidrome 由独立容器托管，所以必须设置：

```env
PERSONAL_MUSIC_MANAGED_NAVIDROME=false
PERSONAL_MUSIC_NAVIDROME_URL=http://navidrome:4533
```

API 下载后的音乐目录和 Navidrome 音乐目录共享同一个 Docker volume：

```yaml
music-library
```

因此下载完成后，Navidrome 可以扫描到同一批音乐文件。

## HTTPS

如果通过 HTTPS 域名访问控制台，需要设置：

```env
PERSONAL_MUSIC_AUTH_SECURE_COOKIE=true
```

如果只是本地或内网用 `http://服务器IP:8787` 测试，保持：

```env
PERSONAL_MUSIC_AUTH_SECURE_COOKIE=false
```

## Amperfy

iOS 端 Amperfy 连接 Navidrome：

```text
Server: https://music.example.com
Username: Navidrome 用户名
Password: Navidrome 密码
```

注意：这是 Navidrome 账号，不是 Personal Music 控制台账号。

## Bilibili Cookie

进入控制台设置页，上传或粘贴从本机浏览器导出的 Netscape `cookies.txt`。

容器内保存路径：

```text
/data/personal-music-stack/cookies/bilibili.txt
```

## 当前限制

- Dockerfile 会在构建时从 GitHub 下载 `yt-dlp`，服务器需要能访问 GitHub。
- Navidrome 使用 `deluan/navidrome:latest`，后续可以锁定版本。
- Postgres 密码需要同时修改 `.env.docker` 和 `docker-compose.yml`。
- 当前没有自动配置反向代理，需要按 `docs/deploy.md` 手动配置 Caddy 或 Nginx。
