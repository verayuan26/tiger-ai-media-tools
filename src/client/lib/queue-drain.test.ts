import { describe, expect, it, vi } from 'vitest';
import { drainUntilIdle } from './queue-drain';
import type { QueueSummary } from '../../shared/types';

function summary(pending: number): QueueSummary {
  return {
    pending,
    processing: 0,
    partial: 0,
    done: 0,
    failed: 0,
    skipped: 0
  };
}

describe('drainUntilIdle', () => {
  it('stops when pending reaches zero', async () => {
    let pending = 5;
    const getSummary = vi.fn(async (): Promise<QueueSummary> => summary(pending));
    const drain = vi.fn(async (limit: number) => {
      const batch = Math.min(limit, pending);
      pending -= batch;
      return { processed: batch, blocked: null, summary: summary(pending) };
    });

    const result = await drainUntilIdle({
      getSummary,
      drain,
      getConcurrentLimit: async () => 3
    });

    expect(result).toMatchObject({ processed: 5, blocked: null, rounds: 2 });
    expect(drain).toHaveBeenCalledTimes(2);
    expect(drain).toHaveBeenNthCalledWith(1, 3);
    expect(drain).toHaveBeenNthCalledWith(2, 3);
  });

  it('returns blocked when drain is rate limited', async () => {
    const getSummary = vi.fn(async () => summary(3));
    const drain = vi.fn(async () => ({
      processed: 1,
      blocked: { code: 'concurrent_limit_reached' as const, message: 'limit' },
      summary: summary(2)
    }));

    const result = await drainUntilIdle({
      getSummary,
      drain,
      getConcurrentLimit: async () => 2
    });

    expect(result.processed).toBe(1);
    expect(result.blocked?.code).toBe('concurrent_limit_reached');
    expect(drain).toHaveBeenCalledTimes(1);
  });
});
