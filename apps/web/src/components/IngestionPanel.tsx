import type { IngestionRecord } from "@personal-music/shared";
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
  return (
    <div className="ingestion-page">
      <div className="section-heading">
        <div>
          <h2>入库记录</h2>
          <div className="meta">共 {ingestions.length} 条资产记录</div>
        </div>
        <button className="button secondary compact" type="button" onClick={onRefresh}>刷新</button>
      </div>
      {message && <div className="settings-message">{message}</div>}
      {!ingestions.length ? <Empty>暂无入库记录。下载完成的新音频会进入这里。</Empty> : (
        <div className="ingestion-list">
          {ingestions.map((ingestion) => (
            <article className="ingestion-card" key={ingestion.id}>
              <div className="row">
                <div>
                  <div className="song-title">{ingestion.title || "未识别标题"}</div>
                  <div className="meta">{formatSource(ingestion)} · {formatDate(ingestion.updatedAt || ingestion.capturedAt)}</div>
                </div>
                <span className={`match-badge ${ingestion.navidromeSongId ? "matched" : ""}`}>
                  {ingestion.navidromeSongId ? "已关联" : "未关联"}
                </span>
              </div>
              <div className="ingestion-grid">
                <IngestionField label="入库 ID" value={ingestion.id} />
                <IngestionField label="文件" value={ingestion.relativeOutputPath || ingestion.outputPath || "未识别"} />
                <IngestionField label="Navidrome ID" value={formatNavidromeMatch(ingestion)} />
                <IngestionField label="源站" value={ingestion.webpageUrl || ingestion.sourceUrl} />
                <IngestionField label="最近匹配" value={formatMatchAttempt(ingestion)} />
              </div>
              <div className="ingestion-actions">
                <button
                  className="button secondary compact"
                  type="button"
                  disabled={rematchingId === ingestion.id}
                  onClick={() => onRematch(ingestion.id)}
                >
                  {rematchingId === ingestion.id ? "匹配中" : "重新匹配"}
                </button>
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
