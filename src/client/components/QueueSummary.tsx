import type { QueueSummary as QueueSummaryType } from '../../shared/types';

interface QueueSummaryProps {
  summary: QueueSummaryType | null;
}

const queueKeys: Array<keyof QueueSummaryType> = ['pending', 'processing', 'partial', 'done', 'failed', 'skipped'];
const queueLabels: Record<keyof QueueSummaryType, string> = {
  pending: '待处理',
  processing: '处理中',
  partial: '部分完成',
  done: '完成',
  failed: '失败',
  skipped: '跳过'
};

export function QueueSummary({ summary }: QueueSummaryProps): React.JSX.Element {
  return (
    <section className="queuePanel" aria-labelledby="queue-heading">
      <div className="sectionHeader">
        <h2 id="queue-heading">队列</h2>
        <span className="countBadge">{summary ? Object.values(summary).reduce((total, value) => total + value, 0) : 0}</span>
      </div>
      <div className="queueGrid">
        {queueKeys.map((key) => (
          <div className={`queueCell queue-${key}`} key={key}>
            <span>{queueLabels[key]}</span>
            <strong>{summary?.[key] ?? 0}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
