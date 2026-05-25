import type { AssetDetailResponse } from '../api';
import { QueueSummary } from './QueueSummary';
import type { QueueSummary as QueueSummaryType } from '../../shared/types';

interface AssetDetailProps {
  detail: AssetDetailResponse | null;
  queueSummary: QueueSummaryType | null;
  loading: boolean;
}

export function AssetDetail({ detail, queueSummary, loading }: AssetDetailProps): React.JSX.Element {
  return (
    <aside className="detailPanel" aria-label="素材详情">
      <QueueSummary summary={queueSummary} />

      {!detail ? (
        <section className="detailEmpty">
          <h2>{loading ? '加载素材详情...' : '选择素材查看详情'}</h2>
        </section>
      ) : (
        <section className="detailContent">
          <div className="detailHeader">
            <span className={`statusPill status-${detail.asset.status}`}>{detail.asset.status}</span>
            <h2 title={detail.asset.fileName}>{detail.asset.fileName}</h2>
            <p title={detail.asset.path}>{detail.asset.path}</p>
          </div>

          <dl className="metaGrid">
            <div>
              <dt>类型</dt>
              <dd>{detail.asset.kind}</dd>
            </div>
            <div>
              <dt>尺寸</dt>
              <dd>{formatDimensions(detail.asset.width, detail.asset.height)}</dd>
            </div>
            <div>
              <dt>时长</dt>
              <dd>{formatDuration(detail.asset.durationSeconds)}</dd>
            </div>
            <div>
              <dt>更新</dt>
              <dd>{formatDate(detail.asset.updatedAt)}</dd>
            </div>
          </dl>

          <DetailSection title="标签" count={detail.tags.length}>
            {detail.tags.length > 0 ? (
              <div className="detailChips">
                {detail.tags.map((tag) => (
                  <span className="tagChip static" key={tag.id}>
                    {tag.displayName}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mutedText">暂无标签。</p>
            )}
          </DetailSection>

          <DetailSection title="关键帧" count={detail.frames.length}>
            {detail.frames.length > 0 ? (
              <ol className="compactList">
                {detail.frames.map((frame) => (
                  <li key={frame.id}>
                    <strong>{formatDuration(frame.timestampSeconds)}</strong>
                    <span>{frame.strategy}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mutedText">暂无帧记录。</p>
            )}
          </DetailSection>

          <DetailSection title="转写片段" count={detail.transcripts.length}>
            {detail.transcripts.length > 0 ? (
              <ol className="transcriptList">
                {detail.transcripts.map((segment) => (
                  <li key={segment.id}>
                    <div>
                      <strong>
                        {formatDuration(segment.startSeconds)} - {formatDuration(segment.endSeconds)}
                      </strong>
                      <span>{segment.language}</span>
                    </div>
                    <p>{segment.text}</p>
                    {segment.translation ? <p className="translationText">{segment.translation}</p> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mutedText">暂无转写。</p>
            )}
          </DetailSection>

          <DetailSection title="任务" count={detail.jobs.length}>
            {detail.jobs.length > 0 ? (
              <ol className="compactList jobList">
                {detail.jobs.map((job) => (
                  <li key={job.id}>
                    <strong>{job.stage}</strong>
                    <span className={`statusPill status-${job.status}`}>{job.status}</span>
                    {job.errorMessage ? <p>{job.errorMessage}</p> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mutedText">暂无任务。</p>
            )}
          </DetailSection>
        </section>
      )}
    </aside>
  );
}

interface DetailSectionProps {
  title: string;
  count: number;
  children: React.ReactNode;
}

function DetailSection({ title, count, children }: DetailSectionProps): React.JSX.Element {
  return (
    <section className="detailSection">
      <div className="sectionHeader">
        <h3>{title}</h3>
        <span className="countBadge">{count}</span>
      </div>
      {children}
    </section>
  );
}

function formatDimensions(width: number | null, height: number | null): string {
  return width && height ? `${width} x ${height}` : '未知';
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '未知';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}
