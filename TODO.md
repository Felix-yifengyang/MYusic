# TODO

## Done

- [x] Build local collector service for yt-dlp audio downloads.
- [x] Integrate Navidrome as the local music library service.
- [x] Build Electron desktop shell with Download / Music Library / Settings tabs.
- [x] Store runtime data on D drive under `D:\project\personal-music-stack-data`.
- [x] Bundle local tools in `bin/`: `node.exe`, `yt-dlp.exe`, `ffmpeg.exe`.
- [x] Add Bilibili cookies.txt support.
- [x] Add Windows setup script for developers.
- [x] Exclude binaries, cookies, local config, build output, and runtime data from Git.

## Next

- [ ] Persist download jobs to `D:\project\personal-music-stack-data\collector\jobs.json`.
- [ ] Add cancel / retry / clear actions for download jobs.
- [ ] Improve the download page UI and job status display.
- [ ] Add a direct link/button from Download to the imported item in Music Library when possible.

## Product

- [x] Add a settings page for data directory, cookie path, logs, and iPhone connection address.
- [x] Add visible collector/Navidrome service status inside the desktop app.
- [x] Add buttons to open data directory, music library, cookie directory, and logs.
- [ ] Add restart controls for collector and Navidrome.
- [ ] Replace embedded service pages with a unified native UI over collector/Navidrome APIs.
- [ ] Add first-run guidance for Bilibili cookies and Navidrome admin account.

## Downloading

- [x] Add cookies.txt support for Bilibili.
- [ ] Add cookie management UI for Bilibili.
- [ ] Add yt-dlp update flow.
- [ ] Add download queue persistence across app restarts.
- [ ] Add retry/cancel controls for running jobs.
- [ ] Improve metadata cleanup for Bilibili downloads.
- [ ] Support playlist/batch mode intentionally instead of always using `--no-playlist`.

## Packaging

- [x] Use stable `win-unpacked` directory build.
- [x] Add setup script to provision local binaries and Navidrome.
- [ ] Add a real app icon.
- [ ] Add version metadata and release notes.
- [ ] Evaluate NSIS installer after reducing signing/cache issues.
- [ ] Evaluate single-file portable later; current NSIS portable was unstable on this machine.

## Cloud

- [ ] Add local/cloud mode configuration.
- [ ] Design cloud API for submitting links and checking download status.
- [ ] Add HTTPS and authentication plan for remote access.
- [ ] Make the desktop app connect to cloud services without starting local services.
- [ ] Decide how cloud storage maps to Navidrome library storage.

## Mobile

- [ ] Document Amperfy setup.
- [x] Show iPhone connection address in Settings.
- [ ] Add LAN IP selection when multiple network interfaces exist.
- [ ] Evaluate whether a PWA or native iOS app is worth building later.
