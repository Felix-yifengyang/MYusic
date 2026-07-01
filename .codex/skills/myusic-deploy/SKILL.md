---
name: myusic-deploy
description: MYusic production deployment guide. Use when Codex needs to enter the MYusic Ubuntu server, pull latest code, rebuild/restart the Docker app service, or verify the deployment is running.
---

# MYusic Deploy

Use this skill only for the basic production deploy workflow.

## Server

- SSH alias: `ssh my-ubuntu`
- App directory: `/opt/MYusic`
- Branch: `master`

## Deploy

Local, before deploying:

```powershell
git status --short
git push origin master
```

Server:

```bash
ssh my-ubuntu
cd /opt/MYusic
git status --short
git pull --ff-only
docker compose up -d --build app
docker compose ps
docker compose logs --tail=80 app
git rev-parse --short HEAD
```

Use `docker compose up -d --build app` for normal app deploys. Do not use `docker compose down -v`.
