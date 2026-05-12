# Music Collector

这是 Personal Music Stack 的下载服务。它只负责一件事：

```text
接收网页链接
→ 调用 yt-dlp
→ 用 ffmpeg 处理音频
→ 保存到统一音乐库
```

## 所在位置

```text
D:\project\personal-music-stack\services\collector
```

## 独立启动

一般情况下从根目录用 `pnpm start` 启动整个产品。需要单独调试 collector 时：

```powershell
cd D:\project\personal-music-stack\services\collector
pnpm start
```

访问：

```text
http://127.0.0.1:8787
```

## 配置

配置文件：

```text
D:\project\personal-music-stack\services\collector\config.json
```

当前音乐库目录：

```text
D:\project\personal-music-stack\library
```

对应配置：

```json
"musicDir": "D:\\project\\personal-music-stack\\library"
```

Navidrome 也扫描同一个目录。
