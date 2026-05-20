import type { FormEvent } from "react";
import type { AppSettings, AuthStatus, CookieFileStatus, DiagnosticsReport, RuntimeStatus } from "@myusic/shared";
import { Empty } from "./common";
import { DiagnosticsList, Fact } from "./StatusPanel";

export interface SettingsPanelProps {
  settings: AppSettings | null;
  status: RuntimeStatus | null;
  authStatus: AuthStatus | null;
  cookieStatus: CookieFileStatus | null;
  diagnostics: DiagnosticsReport | null;
  settingsMessage: string;
  bilibiliCookieText: string;
  bilibiliCookieMessage: string;
  bilibiliCookieSaving: boolean;
  currentPassword: string;
  newPassword: string;
  passwordMessage: string;
  passwordSaving: boolean;
  onSettingsChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onSettingsSubmit: (event: FormEvent) => void;
  onCookieContentChange: (value: string) => void;
  onCookieFileLoad: (file: File | undefined) => void;
  onCookieSubmit: (event: FormEvent) => void;
  onCookieClear: () => void;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onPasswordSubmit: (event: FormEvent) => void;
  onLogoutAllDevices: () => void;
}

export function SettingsPanel({
  settings,
  status,
  authStatus,
  cookieStatus,
  diagnostics,
  settingsMessage,
  bilibiliCookieText,
  bilibiliCookieMessage,
  bilibiliCookieSaving,
  currentPassword,
  newPassword,
  passwordMessage,
  passwordSaving,
  onSettingsChange,
  onSettingsSubmit,
  onCookieContentChange,
  onCookieFileLoad,
  onCookieSubmit,
  onCookieClear,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onPasswordSubmit,
  onLogoutAllDevices
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
              status={cookieStatus}
              content={bilibiliCookieText}
              message={bilibiliCookieMessage}
              saving={bilibiliCookieSaving}
              onContentChange={onCookieContentChange}
              onFileLoad={onCookieFileLoad}
              onSubmit={onCookieSubmit}
              onClear={onCookieClear}
            />
          </>
        ) : (
          <Empty>正在读取设置</Empty>
        )}
      </section>
      <section className="block">
        <h2>账号和连接</h2>
        <AccountSecurity
          authStatus={authStatus}
          currentPassword={currentPassword}
          newPassword={newPassword}
          message={passwordMessage}
          saving={passwordSaving}
          onCurrentPasswordChange={onCurrentPasswordChange}
          onNewPasswordChange={onNewPasswordChange}
          onSubmit={onPasswordSubmit}
          onLogoutAllDevices={onLogoutAllDevices}
        />
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

function AccountSecurity({
  authStatus,
  currentPassword,
  newPassword,
  message,
  saving,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onSubmit,
  onLogoutAllDevices
}: {
  authStatus: AuthStatus | null;
  currentPassword: string;
  newPassword: string;
  message: string;
  saving: boolean;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onLogoutAllDevices: () => void;
}) {
  if (!authStatus?.enabled) {
    return <Empty>当前未启用登录鉴权</Empty>;
  }

  return (
    <form className="account-security" onSubmit={onSubmit}>
      <div className="facts">
        <Fact label="当前用户" value={authStatus.user?.username || "未知"} />
        <Fact label="权限" value={authStatus.user?.role || "admin"} />
      </div>
      <label>
        <span>当前密码</span>
        <input type="password" value={currentPassword} onChange={(event) => onCurrentPasswordChange(event.target.value)} autoComplete="current-password" />
      </label>
      <label>
        <span>新密码</span>
        <input type="password" value={newPassword} onChange={(event) => onNewPasswordChange(event.target.value)} autoComplete="new-password" />
      </label>
      <div className="inline-actions">
        <button className="button" type="submit" disabled={saving}>
          {saving ? "保存中..." : "修改密码"}
        </button>
        <button className="button secondary" type="button" onClick={onLogoutAllDevices}>
          退出所有设备
        </button>
      </div>
      {message && <div className="settings-message">{message}</div>}
    </form>
  );
}

function BilibiliCookieManager({
  path,
  status,
  content,
  message,
  saving,
  onContentChange,
  onFileLoad,
  onSubmit,
  onClear
}: {
  path: string;
  status: CookieFileStatus | null;
  content: string;
  message: string;
  saving: boolean;
  onContentChange: (value: string) => void;
  onFileLoad: (file: File | undefined) => void;
  onSubmit: (event: FormEvent) => void;
  onClear: () => void;
}) {
  return (
    <form className="cookie-manager" onSubmit={onSubmit}>
      <div>
        <h3>Bilibili Cookie</h3>
        <div className="meta">当前路径：{path || "未配置"}</div>
      </div>
      <div className="facts">
        <Fact label="文件状态" value={formatCookieStatus(status)} />
        <Fact label="更新时间" value={status?.updatedAt ? new Date(status.updatedAt).toLocaleString() : "无"} />
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
      <div className="inline-actions">
        <button className="button secondary" type="submit" disabled={saving}>
          {saving ? "保存中..." : "保存 Cookie"}
        </button>
        <button className="button secondary" type="button" onClick={onClear} disabled={saving || !status?.exists}>
          清空 Cookie
        </button>
      </div>
      {message && <div className="settings-message">{message}</div>}
    </form>
  );
}

function LanSettings({ status }: { status: RuntimeStatus }) {
  if (!status.lan.length) return <Empty>没有检测到局域网 IP</Empty>;

  return (
    <div className="facts lan-settings">
      {status.lan.map((item) => (
        <Fact label={item.address} value={`控制台：${item.collectorUrl} / Amperfy：${item.navidromeUrl}`} key={item.address} />
      ))}
    </div>
  );
}

function formatCookieStatus(status: CookieFileStatus | null) {
  if (!status) return "正在读取";
  if (!status.exists) return "未配置";
  return `已配置，${formatBytes(status.size)}`;
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
