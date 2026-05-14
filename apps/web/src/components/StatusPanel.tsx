import type { DiagnosticCheck, DiagnosticsReport, RuntimeStatus } from "@personal-music/shared";
import { Empty } from "./common";

export function StatusPanel({
  status,
  diagnostics,
  compactDiagnostics = false
}: {
  status: RuntimeStatus | null;
  diagnostics: DiagnosticsReport | null;
  compactDiagnostics?: boolean;
}) {
  return (
    <>
      {status ? <QuickStatus status={status} /> : <Empty>正在读取状态</Empty>}
      {diagnostics && <DiagnosticsList diagnostics={diagnostics} compact={compactDiagnostics} />}
    </>
  );
}

export function DiagnosticsList({ diagnostics, compact = false }: { diagnostics: DiagnosticsReport; compact?: boolean }) {
  const visibleChecks = compact ? diagnostics.checks.filter((check) => check.level !== "ok") : diagnostics.checks;

  if (compact && !visibleChecks.length) {
    return <div className="diagnostics-summary ok">环境检查正常</div>;
  }

  return (
    <div className="diagnostics">
      {!compact && <div className={`diagnostics-summary ${diagnostics.ok ? "ok" : "error"}`}>{diagnostics.ok ? "环境检查正常" : "环境存在问题"}</div>}
      {visibleChecks.map((check) => <DiagnosticItem check={check} key={check.id} />)}
    </div>
  );
}

function QuickStatus({ status }: { status: RuntimeStatus }) {
  return (
    <div className="facts">
      <Fact label="下载服务" value={status.collectorUrl} />
      <Fact label="音乐库服务" value={status.navidromeUrl} />
      <Fact label="Bilibili Cookie" value={status.cookies.bilibili.exists ? "已配置" : "未配置"} />
      <Fact label="yt-dlp" value={status.tools.ytdlpExists ? "可用" : "未找到"} />
      <Fact label="ffmpeg" value={status.tools.ffmpegExists ? "可用" : "未找到"} />
    </div>
  );
}

function DiagnosticItem({ check }: { check: DiagnosticCheck }) {
  return (
    <article className={`diagnostic ${check.level}`}>
      <div className="row">
        <strong>{check.label}</strong>
        <span>{check.level}</span>
      </div>
      <div className="value">{check.message}</div>
      {check.suggestion && <div className="suggestion">{check.suggestion}</div>}
    </article>
  );
}

export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <article className="fact">
      <div className="row"><strong>{label}</strong></div>
      <div className="value">{value}</div>
    </article>
  );
}
