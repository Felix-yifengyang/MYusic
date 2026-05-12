# TODO

## Product

- [ ] Add a settings page for data directory, service ports, cookie path, and cloud mode.
- [ ] Replace the embedded service pages with a unified native UI over collector/Navidrome APIs.
- [ ] Add visible service status and restart controls inside the desktop app.
- [ ] Add buttons to open the data directory, logs, collector page, and Navidrome page.

## Downloading

- [ ] Add cookie management UI for Bilibili.
- [ ] Add yt-dlp update flow.
- [ ] Add download queue persistence across app restarts.
- [ ] Add retry/cancel controls for running jobs.
- [ ] Improve metadata cleanup for Bilibili downloads.

## Packaging

- [ ] Decide between unpacked directory, installer, and portable single-file distribution.
- [ ] Add a real app icon.
- [ ] Add version metadata and release notes.
- [ ] Avoid committing local binaries; document how to provision `bin/` and Navidrome.

## Cloud

- [ ] Add local/cloud mode configuration.
- [ ] Design cloud API for submitting links and checking download status.
- [ ] Add HTTPS and authentication plan for remote access.
- [ ] Make the desktop app connect to cloud services without starting local services.

## Mobile

- [ ] Document Amperfy setup.
- [ ] Add LAN IP discovery helper for iPhone connection.
- [ ] Evaluate whether a PWA or native iOS app is worth building later.
