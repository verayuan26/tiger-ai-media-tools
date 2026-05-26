import { useCallback, useEffect, useState } from 'react';
import { getQueueSummary } from '../api';
import { queueBadgeCount } from '../lib/format';
import { readErrorMessage } from '../lib/errors';
import type { QueueSummary } from '../../shared/types';

export function useQueueSummary(pollMs = 15000): {
  summary: QueueSummary | null;
  badge: number;
  refresh: () => Promise<void>;
  error: string | null;
} {
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSummary(await getQueueSummary());
      setError(null);
    } catch (caughtError) {
      setError(readErrorMessage(caughtError));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(timer);
  }, [pollMs, refresh]);

  return {
    summary,
    badge: summary ? queueBadgeCount(summary) : 0,
    refresh,
    error
  };
}
