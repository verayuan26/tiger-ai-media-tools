export function formatDateTime(value: string | null): string {
  if (!value) return '从未';

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export function queueBadgeCount(summary: {
  pending: number;
  processing: number;
  failed: number;
}): number {
  return summary.pending + summary.processing + summary.failed;
}
