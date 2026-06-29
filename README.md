# MYusic

**MYusic 是一个私人音乐房间。**

把音乐链接放进来，MYusic 会下载、入库，然后你可以在网页里的唱片柜和唱片机中播放它们。手机上也可以用支持 Navidrome / Subsonic 的播放器连接音乐库。

## 启动

需要先安装：

- Node.js 18+
- pnpm

第一次运行：

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

## 怎么用

1. 打开 MYusic。
2. 第一次进入时，按提示创建管理员账号。
3. 进入房间里的电脑，打开“收集”。
4. 粘贴音乐链接，开始下载。
5. 下载完成后，回到唱片柜或唱片机播放。

如果 Bilibili 下载失败，到“设置”里上传或粘贴 Cookie。

## 房间里有什么

- 唱片机：播放音乐和操作播放列表。
- 唱片柜：浏览和选择音乐。
- 电脑：下载、入库、设置和音乐问答。

## 手机播放

本机 Navidrome 地址：

```text
http://127.0.0.1:4533
```

手机访问时，把 `127.0.0.1` 换成电脑的局域网 IP，并确保手机和电脑在同一个网络里。

## 数据位置

默认数据在项目旁边：

```text
D:\project\MYusic-data
```

这里会保存音乐文件、Cookie、运行配置和播放服务数据。需要备份时，优先备份这个文件夹。

## 可选配置

通常不用改配置。需要改音乐目录、数据库、登录、Navidrome 或音乐问答时，再复制 `.env.example`：

```powershell
Copy-Item .env.example .env
```
