import type { IngestionRecord } from "@myusic/shared";
import { Button, EmptyState, StatPill } from "./ui";

export interface IngestionPanelProps {
  ingestions: IngestionRecord[];
  message: string;
  rematchingId: string;
  onRefresh: () => void;
  onRematch: (id: string) => void;
}

export function IngestionPanel({
  ingestions,
  message,
  rematchingId,
  onRefresh,
  onRematch
}: IngestionPanelProps) {
  const counts = summarizeIngestions(ingestions);

  return (
    <div className="ingestion-page">
      <div className="ingestion-toolbar">
        <div className="ingestion-stats">
          <StatPill label="已关联" value={counts.matched} tone="ok" />
          <StatPill label="待关联" value={counts.unmatched} tone={counts.unmatched ? "warn" : "neutral"} />
        </div>
      </div>
      <div className="section-heading">
        <div>
          <h3>入库列表</h3>
        </div>
        <Button variant="secondary" type="button" onClick={onRefresh}>刷新</Button>
      </div>
      {message && <div className="settings-message">{message}</div>}
      {!ingestions.length ? <EmptyState>暂无入库记录。下载完成的新音频会进入这里。</EmptyState> : (
        <div className="ingestion-list">
          {ingestions.map((ingestion) => (
            <article className={`ingestion-card ${ingestion.navidromeSongId ? "matched" : "unmatched"}`} key={ingestion.id}>
              <div className="ingestion-main">
                <div className="ingestion-status-mark" aria-hidden="true" />
                <div className="ingestion-title">
                  <strong>{ingestion.title || "未识别标题"}</strong>
                  <span>{formatSource(ingestion)} · {formatDate(ingestion.updatedAt || ingestion.capturedAt)}</span>
                </div>
                <span className={`match-badge ${ingestion.navidromeSongId ? "matched" : ""}`}>
                  {ingestion.navidromeSongId ? "已关联" : "未关联"}
                </span>
              </div>

              <details className="ingestion-details-toggle">
                <summary>详细信息</summary>
                <div className="ingestion-details">
                  <IngestionField label="入库 ID" value={ingestion.id} />
                  <IngestionField label="文件" value={ingestion.relativeOutputPath || ingestion.outputPath || "未识别"} />
                  <IngestionField label="Navidrome ID" value={formatNavidromeMatch(ingestion)} />
                  <IngestionField label="源站" value={ingestion.webpageUrl || ingestion.sourceUrl} />
                  <IngestionField label="最近匹配" value={formatMatchAttempt(ingestion)} />
                </div>
              </details>
              <div className="ingestion-actions">
                <Button
                  variant="secondary"
                  type="button"
                  disabled={rematchingId === ingestion.id}
                  onClick={() => onRematch(ingestion.id)}
                >
                  {rematchingId === ingestion.id ? "匹配中" : "重新匹配"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function IngestionField({ label, value }: { label: string; value: string }) {
  return (
    <div className="ingestion-field">
      <span>{label}</span>
      <div>{value}</div>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString();
}

function formatSource(ingestion: IngestionRecord) {
  const site = ingestion.sourceSite || "Unknown";
  const uploader = ingestion.uploader ? ` · ${ingestion.uploader}` : "";
  return `${site}${uploader}`;
}

function formatNavidromeMatch(ingestion: IngestionRecord) {
  if (!ingestion.navidromeSongId) return "未关联";
  const method = ingestion.navidromeMatchMethod ? ` · ${ingestion.navidromeMatchMethod}` : "";
  return `${ingestion.navidromeSongId}${method}`;
}

function formatMatchAttempt(ingestion: IngestionRecord) {
  if (ingestion.navidromeMatchError) return ingestion.navidromeMatchError;
  if (ingestion.navidromeLastMatchAttemptAt) return formatDate(ingestion.navidromeLastMatchAttemptAt);
  if (ingestion.navidromeMatchedAt) return formatDate(ingestion.navidromeMatchedAt);
  return "未尝试";
}

function summarizeIngestions(ingestions: IngestionRecord[]) {
  return ingestions.reduce(
    (summary, ingestion) => {
      if (ingestion.navidromeSongId) summary.matched += 1;
      else summary.unmatched += 1;
      return summary;
    },
    { matched: 0, unmatched: 0 }
  );
}
