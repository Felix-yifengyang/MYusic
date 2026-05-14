import type { FormEvent } from "react";
import type { AppSettings, DiagnosticsReport, RuntimeStatus } from "@personal-music/shared";
import { Empty } from "./common";
import { DiagnosticsList, Fact } from "./StatusPanel";

export interface SettingsPanelProps {
  settings: AppSettings | null;
  status: RuntimeStatus | null;
  diagnostics: DiagnosticsReport | null;
  settingsMessage: string;
  bilibiliCookieText: string;
  bilibiliCookieMessage: string;
  bilibiliCookieSaving: boolean;
  onSettingsChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onSettingsSubmit: (event: FormEvent) => void;
  onCookieContentChange: (value: string) => void;
  onCookieFileLoad: (file: File | undefined) => void;
  onCookieSubmit: (event: FormEvent) => void;
}

export function SettingsPanel({
  settings,
  status,
  diagnostics,
  settingsMessage,
  bilibiliCookieText,
  bilibiliCookieMessage,
  bilibiliCookieSaving,
  onSettingsChange,
  onSettingsSubmit,
  onCookieContentChange,
  onCookieFileLoad,
  onCookieSubmit
}: SettingsPanelProps) {
  return (
    <section className="grid">
      <section className="block">
        <h2>路径和工具</h2>
        {settings ? (
          <>
            <SettingsForm
              settings={settings}
              message={settingsMessage}
              onChange={onSettingsChange}
              onSubmit={onSettingsSubmit}
            />
            <BilibiliCookieManager
              path={settings.bilibiliCookiesPath}
              content={bilibiliCookieText}
              message={bilibiliCookieMessage}
              saving={bilibiliCookieSaving}
              onContentChange={onCookieContentChange}
              onFileLoad={onCookieFileLoad}
              onSubmit={onCookieSubmit}
            />
          </>
        ) : (
          <Empty>正在读取设置</Empty>
        )}
      </section>
      <section className="block">
        <h2>手机连接</h2>
        {status ? <LanSettings status={status} /> : <Empty>正在读取局域网地址</Empty>}
        {diagnostics && <DiagnosticsList diagnostics={diagnostics} />}
      </section>
    </section>
  );
}

function SettingsForm({
  settings,
  message,
  onChange,
  onSubmit
}: {
  settings: AppSettings;
  message: string;
  onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form className="settings-form" onSubmit={onSubmit}>
      <label>
        <span>音乐目录</span>
        <input value={settings.musicDir} onChange={(event) => onChange("musicDir", event.target.value)} />
      </label>
      <label>
        <span>Bilibili Cookie</span>
        <input value={settings.bilibiliCookiesPath} onChange={(event) => onChange("bilibiliCookiesPath", event.target.value)} />
      </label>
      <label>
        <span>yt-dlp</span>
        <input value={settings.ytdlpPath} onChange={(event) => onChange("ytdlpPath", event.target.value)} />
      </label>
      <label>
        <span>ffmpeg</span>
        <input value={settings.ffmpegPath} onChange={(event) => onChange("ffmpegPath", event.target.value)} />
      </label>
      <label>
        <span>音频格式</span>
        <select value={settings.audioFormat} onChange={(event) => onChange("audioFormat", event.target.value)}>
          <option value="mp3">mp3</option>
          <option value="m4a">m4a</option>
          <option value="opus">opus</option>
          <option value="flac">flac</option>
          <option value="wav">wav</option>
        </select>
      </label>
      <label>
        <span>音频质量</span>
        <input value={settings.audioQuality} onChange={(event) => onChange("audioQuality", event.target.value)} />
      </label>
      <label>
        <span>Navidrome 地址</span>
        <input value={settings.navidromeBaseUrl} onChange={(event) => onChange("navidromeBaseUrl", event.target.value)} />
      </label>
      <label>
        <span>Navidrome 用户名</span>
        <input value={settings.navidromeUsername} onChange={(event) => onChange("navidromeUsername", event.target.value)} />
      </label>
      <label>
        <span>Navidrome 密码</span>
        <input type="password" value={settings.navidromePassword} onChange={(event) => onChange("navidromePassword", event.target.value)} />
      </label>
      <label>
        <span>最多保留任务</span>
        <input type="number" min="1" max="500" value={settings.maxJobs} onChange={(event) => onChange("maxJobs", Number(event.target.value))} />
      </label>
      <button className="button" type="submit">保存设置</button>
      {message && <div className="settings-message">{message}</div>}
    </form>
  );
}

function BilibiliCookieManager({
  path,
  content,
  message,
  saving,
  onContentChange,
  onFileLoad,
  onSubmit
}: {
  path: string;
  content: string;
  message: string;
  saving: boolean;
  onContentChange: (value: string) => void;
  onFileLoad: (file: File | undefined) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form className="cookie-manager" onSubmit={onSubmit}>
      <div>
        <h3>Bilibili Cookie</h3>
        <div className="meta">当前路径：{path || "未配置"}</div>
      </div>
      <label>
        <span>选择 cookies.txt</span>
        <input type="file" accept=".txt,text/plain" onChange={(event) => onFileLoad(event.target.files?.[0])} />
      </label>
      <label>
        <span>或粘贴内容</span>
        <textarea
          value={content}
          onChange={(event) => onContentChange(event.target.value)}
          placeholder="# Netscape HTTP Cookie File&#10;.bilibili.com&#9;TRUE&#9;/&#9;FALSE..."
          spellCheck={false}
        />
      </label>
      <button className="button secondary" type="submit" disabled={saving}>
        {saving ? "保存中" : "保存 Cookie"}
      </button>
      {message && <div className="settings-message">{message}</div>}
    </form>
  );
}

function LanSettings({ status }: { status: RuntimeStatus }) {
  if (!status.lan.length) return <Empty>没有检测到局域网 IP</Empty>;

  return (
    <div className="facts">
      {status.lan.map((item) => (
        <Fact label={item.address} value={`控制台：${item.collectorUrl} / Amperfy：${item.navidromeUrl}`} key={item.address} />
      ))}
    </div>
  );
}
