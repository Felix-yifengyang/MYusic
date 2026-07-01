---
name: myusic-deploy
description: MYusic production server deployment and operations guide. Use when Codex needs to deploy MYusic, inspect the production Ubuntu server, check Docker containers, verify Postgres/Navidrome user-library isolation, troubleshoot server-side MYusic issues, or explain the live deployment workflow.
---

# MYusic Deploy

Use this skill for production operations for the MYusic project.

## Server

- SSH alias: `ssh my-ubuntu`
- Direct host if needed: `ubuntu@114.132.122.19`
- App path: `/opt/MYusic`
- Main branch: `master`
- Current Docker Compose services:
  - `myusic-app-1`
  - `myusic-navidrome-1`
  - `myusic-postgres-1`
- Public ports:
  - MYusic web/API: `8787`
  - Navidrome: `4533`

Do not write secrets into repo files or skill files. `.env.docker` on the server contains deployment secrets.

## Safety Rules

- Never run `docker compose down -v`.
- Never delete Docker volumes unless the user explicitly asks and backup status is clear.
- Never hard-delete music files unless the user explicitly confirms the exact path.
- Prefer `docker compose up -d --build app` for app deploys; this rebuilds/recreates only the app service and leaves Postgres/Navidrome data volumes intact.
- Treat `docker-compose.yml` local changes on the server carefully. If only `.env.docker` should hold secrets, do not commit password edits to `docker-compose.yml`.
- Before deployment, run relevant local typechecks and ensure changes are committed and pushed.

## Deploy Workflow

Local:

```powershell
git status --short
node_modules\.bin\tsc.cmd -p packages\api\tsconfig.json --noEmit
node_modules\.bin\tsc.cmd -p apps\web\tsconfig.json --noEmit
git add <changed-files>
git commit -m "<message>"
git push origin master
```

Server:

```bash
ssh my-ubuntu
cd /opt/MYusic
git status --short
git rev-parse --abbrev-ref HEAD
git pull --ff-only
docker compose up -d --build app
docker compose ps
docker compose logs --tail=80 app
git rev-parse --short HEAD
```

Use `docker compose up -d --build app`, not a full stack teardown.

## Common Checks

App health and logs:

```bash
cd /opt/MYusic
docker compose ps
docker compose logs --tail=80 app
docker compose logs --tail=80 navidrome
```

MYusic users and Navidrome bindings:

```bash
docker compose exec -T postgres psql -U myusic -d myusic -c 'select username, role, navidrome_username, navidrome_library_id from users order by username;'
```

Navidrome libraries and user-library mapping:

```bash
docker compose exec -T navidrome sqlite3 /data/navidrome.db 'select id,name,path from library order by id'
docker compose exec -T navidrome sqlite3 /data/navidrome.db 'select u.user_name,u.is_admin,ul.library_id from user u left join user_library ul on ul.user_id=u.id order by u.user_name,ul.library_id'
docker compose exec -T navidrome sqlite3 /data/navidrome.db 'select library_id,count(*) from media_file group by library_id order by library_id'
```

Music folders inside Navidrome container:

```bash
docker compose exec navidrome sh
ls -lah /music/users
du -sh /music/users/*
```

## Current Multi-User Model

- MYusic `admin` is a management-only account.
- Listening accounts are MYusic `member` users such as `felix` and `marina`.
- Each member should have:
  - a MYusic user row with `navidrome_username`
  - a MYusic user row with `navidrome_library_id`
  - a Navidrome non-admin user
  - a Navidrome library pointing to `/music/users/<myusic-user-id>`
  - a `user_library` mapping to exactly that library
- Users without `navidrome_library_id` should not see songs and should not be able to download/rematch.
- Navidrome old root library `1 | Music Library | /music` was removed from the server DB to prevent duplicate indexing.

Expected server shape after the multi-user migration:

```text
MYusic:
admin  | admin  | null   | null
felix  | member | felix  | 3
marina | member | marina | 4

Navidrome library:
3 | felix Library  | /music/users/3973d541-3814-43c6-b076-2090d9a58133
4 | marina Library | /music/users/7ef9ac24-c41b-4184-a956-e634aee4f2cc
```

Do not assume these ids are permanent; verify with the database commands above.

## Configuration Notes

- Docker app service sets `MYUSIC_NAVIDROME_MUSIC_FOLDER=/music`; this is required because the app container sees the shared volume at `/data/MYusic/library`, while Navidrome sees it at `/music`.
- Navidrome must keep multi-library enabled: `ND_ENABLEMULTILIBRARY: "true"`.
- Navidrome music folder is `/music`.
- Postgres storage is used for MYusic auth/jobs/ingestions.

## Known Backup

A server backup was created earlier at:

```text
/home/ubuntu/myusic-backups/20260630-175629
```

It contains database dump and volume tarballs, including music and Navidrome data. Verify it still exists before relying on it.
