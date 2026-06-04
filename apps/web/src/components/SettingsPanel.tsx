import type { FormEvent } from "react";
import type { AppSettings, AuthStatus, CookieFileStatus, DiagnosticsReport, RuntimeStatus } from "@myusic/shared";
import { DiagnosticsList, Fact } from "./StatusPanel";
import { Button, Disclosure, EmptyState, Field, Panel } from "./ui";

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
    <section className="settings-page">
      {settings ? (
        <>
          <Panel title="音乐服务" description="音乐目录、Navidrome 和音频输出。" wide>
            <SettingsForm
              settings={settings}
              message={settingsMessage}
              onChange={onSettingsChange}
              onSubmit={onSettingsSubmit}
            />
          </Panel>
          <Panel title="Bilibili Cookie" description="用于访问需要 Cookie 的视频源。">
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
          </Panel>
        </>
      ) : (
        <Panel><EmptyState>正在读取设置</EmptyState></Panel>
      )}

      <Panel title="账号安全" description="修改密码或让所有设备重新登录。">
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
      </Panel>

      <Panel title="连接地址" description="局域网和移动端访问入口。">
        {status ? <LanSettings status={status} /> : <EmptyState>正在读取局域网地址</EmptyState>}
      </Panel>

      <Panel title="环境诊断" description="检查下载工具、Cookie 和音乐服务连接。" wide>
        {diagnostics && <DiagnosticsList diagnostics={diagnostics} compact />}
      </Panel>
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
      <div className="settings-field-grid">
        <Field label="音乐目录">
          <input value={settings.musicDir} onChange={(event) => onChange("musicDir", event.target.value)} />
        </Field>
        <Field label="Navidrome 地址">
          <input value={settings.navidromeBaseUrl} onChange={(event) => onChange("navidromeBaseUrl", event.target.value)} />
        </Field>
        <Field label="Navidrome 用户名">
          <input value={settings.navidromeUsername} onChange={(event) => onChange("navidromeUsername", event.target.value)} />
        </Field>
        <Field label="Navidrome 密码">
          <input type="password" value={settings.navidromePassword} onChange={(event) => onChange("navidromePassword", event.target.value)} />
        </Field>
      </div>
      <Disclosure title="下载与转码" description="不常改动的路径、格式和任务保留策略。">
        <div className="settings-field-grid">
        <Field label="yt-dlp">
          <input value={settings.ytdlpPath} onChange={(event) => onChange("ytdlpPath", event.target.value)} />
        </Field>
        <Field label="ffmpeg">
          <input value={settings.ffmpegPath} onChange={(event) => onChange("ffmpegPath", event.target.value)} />
        </Field>
        <Field label="音频格式">
          <select value={settings.audioFormat} onChange={(event) => onChange("audioFormat", event.target.value)}>
            <option value="mp3">mp3</option>
            <option value="m4a">m4a</option>
            <option value="opus">opus</option>
            <option value="flac">flac</option>
            <option value="wav">wav</option>
          </select>
        </Field>
        <Field label="音频质量">
          <input value={settings.audioQuality} onChange={(event) => onChange("audioQuality", event.target.value)} />
        </Field>
        <Field label="最多保留任务">
          <input type="number" min="1" max="500" value={settings.maxJobs} onChange={(event) => onChange("maxJobs", Number(event.target.value))} />
        </Field>
        <Field label="Bilibili Cookie 路径">
          <input value={settings.bilibiliCookiesPath} onChange={(event) => onChange("bilibiliCookiesPath", event.target.value)} />
        </Field>
        </div>
      </Disclosure>
      <Button className="settings-primary" type="submit">保存设置</Button>
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
    return <EmptyState>当前未启用登录鉴权</EmptyState>;
  }

  return (
    <form className="account-security" onSubmit={onSubmit}>
      <div className="facts">
        <Fact label="当前用户" value={authStatus.user?.username || "未知"} />
        <Fact label="权限" value={authStatus.user?.role || "admin"} />
      </div>
      <Field label="当前密码">
        <input type="password" value={currentPassword} onChange={(event) => onCurrentPasswordChange(event.target.value)} autoComplete="current-password" />
      </Field>
      <Field label="新密码">
        <input type="password" value={newPassword} onChange={(event) => onNewPasswordChange(event.target.value)} autoComplete="new-password" />
      </Field>
      <div className="inline-actions">
        <Button type="submit" disabled={saving}>
          {saving ? "保存中..." : "修改密码"}
        </Button>
        <Button variant="secondary" type="button" onClick={onLogoutAllDevices}>
          退出所有设备
        </Button>
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
      <div className="settings-message">当前路径：{path || "未配置"}</div>
      <div className="facts">
        <Fact label="文件状态" value={formatCookieStatus(status)} />
        <Fact label="更新时间" value={status?.updatedAt ? new Date(status.updatedAt).toLocaleString() : "无"} />
      </div>
      <Disclosure title="更新 Cookie" description="上传或粘贴 cookies.txt 内容。">
        <Field label="选择 cookies.txt">
          <input type="file" accept=".txt,text/plain" onChange={(event) => onFileLoad(event.target.files?.[0])} />
        </Field>
        <Field label="或粘贴内容">
          <textarea
            value={content}
            onChange={(event) => onContentChange(event.target.value)}
            placeholder="# Netscape HTTP Cookie File&#10;.bilibili.com&#9;TRUE&#9;/&#9;FALSE..."
            spellCheck={false}
          />
        </Field>
        <div className="inline-actions">
          <Button variant="secondary" type="submit" disabled={saving}>
            {saving ? "保存中..." : "保存 Cookie"}
          </Button>
          <Button variant="secondary" type="button" onClick={onClear} disabled={saving || !status?.exists}>
            清空 Cookie
          </Button>
        </div>
      </Disclosure>
      {message && <div className="settings-message">{message}</div>}
    </form>
  );
}

function LanSettings({ status }: { status: RuntimeStatus }) {
  if (!status.lan.length) return <EmptyState>没有检测到局域网 IP</EmptyState>;

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
