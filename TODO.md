# TODO

## Done

- [x] Build local collector service for yt-dlp audio downloads.
- [x] Integrate Navidrome as the local music library service.
- [x] Store runtime data on D drive under `D:\project\personal-music-stack-data`.
- [x] Bundle local download tools in `bin/`: `yt-dlp.exe`, `ffmpeg.exe`.
- [x] Add Bilibili cookies.txt support.
- [x] Add Windows setup script for developers.
- [x] Exclude binaries, cookies, local config, build output, and runtime data from Git.
- [x] Replace the Electron shell with a lightweight local Web console.
- [x] Put Download / Music List / Settings into one browser page.
- [x] Add a collector-side local music list by scanning the library folder.
- [x] Show cookie status, tool status, data paths, and LAN connection URLs in Settings.
- [x] Restructure into pnpm workspace with React web, Fastify API, runtime, downloader, and shared packages.
- [x] Persist download jobs to `D:\project\personal-music-stack-data\collector\jobs.json`.
- [x] Add cancel / retry / clear finished actions for download jobs.
- [x] Add diagnostics API and UI for tools, cookie, directories, task store, and Navidrome.

## Next

- [ ] Add a file detail view for downloaded songs.
- [ ] Improve metadata cleanup for Bilibili downloads.
- [ ] Add a direct link from a completed download job to the local music list item.

## Product

- [x] Add editable settings UI backed by local `api.json`.
- [ ] Decide whether the built-in music list should stay file-based or move to Navidrome API.
- [x] Add first-run diagnostics for local tools and writable data paths.
- [ ] Add first-run guidance for Bilibili cookies and Navidrome admin account.
- [ ] Add cookie management UI for Bilibili.
- [ ] Add yt-dlp update flow.
- [ ] Add service restart controls for collector and Navidrome.
- [ ] Add LAN IP selection when multiple network interfaces exist.
- [ ] Rename remaining user-facing "collector" wording to API/Web Console where appropriate.

## Downloading

- [x] Add cookies.txt support for Bilibili.
- [x] Add download queue persistence across restarts.
- [x] Add retry/cancel controls for running jobs.
- [ ] Support playlist/batch mode intentionally instead of always using `--no-playlist`.
- [ ] Add per-site presets if Bilibili / YouTube / other sites need different options.

## Cloud

- [ ] Introduce a persistence repository layer so local JSON can be swapped for a server database.
- [ ] Move settings, download jobs, users, and library metadata to server-side Postgres for cloud deployment.
- [ ] Add local/cloud mode configuration.
- [ ] Design cloud API for submitting links and checking download status.
- [ ] Add HTTPS and authentication plan for remote access.
- [ ] Decide how cloud storage maps to Navidrome library storage.
- [ ] Decide whether the Web console should be deployable as a single server process.

## Mobile

- [ ] Document Amperfy setup.
- [x] Show iPhone connection address in Settings.
- [ ] Evaluate whether a PWA or native iOS app is worth building later.
