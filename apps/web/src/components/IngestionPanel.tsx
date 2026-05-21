import type { IngestionRecord } from "@myusic/shared";
import { Empty } from "./common";

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
      <div className="ingestion-hero">
        <div>
          <span>Ingestion</span>
          <h2>同步与匹配记录</h2>
          <p>{counts.unmatched ? `${counts.unmatched} 条记录需要重新匹配。` : "所有入库记录都已经关联到音乐库。"}</p>
        </div>
        <button type="button" onClick={onRefresh}>刷新</button>
      </div>

      {!!ingestions.length && (
        <div className="ingestion-stats">
          <div className="summary-pill ok"><span>已关联</span><strong>{counts.matched}</strong></div>
          <div className={`summary-pill ${counts.unmatched ? "warn" : "neutral"}`}><span>待关联</span><strong>{counts.unmatched}</strong></div>
        </div>
      )}
      {message && <div className="settings-message">{message}</div>}
      {!ingestions.length ? <Empty>暂无入库记录。下载完成的新音频会进入这里。</Empty> : (
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
                <div className="ingestion-actions">
                  <button
                    type="button"
                    disabled={rematchingId === ingestion.id}
                    onClick={() => onRematch(ingestion.id)}
                  >
                    {rematchingId === ingestion.id ? "匹配中" : "重新匹配"}
                  </button>
                </div>
              </div>

              <div className="ingestion-details">
                <IngestionField label="入库 ID" value={ingestion.id} />
                <IngestionField label="文件" value={ingestion.relativeOutputPath || ingestion.outputPath || "未识别"} />
                <IngestionField label="Navidrome ID" value={formatNavidromeMatch(ingestion)} />
                <IngestionField label="源站" value={ingestion.webpageUrl || ingestion.sourceUrl} />
                <IngestionField label="最近匹配" value={formatMatchAttempt(ingestion)} />
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
