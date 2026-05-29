import type { DrainJobsResponse } from '../api';
import type { DrainBlockedInfo } from '../../shared/settings';
import type { QueueSummary } from '../../shared/types';

export interface DrainUntilIdleInput {
  getSummary: () => Promise<QueueSummary>;
  drain: (limit: number) => Promise<DrainJobsResponse>;
  getConcurrentLimit: () => Promise<number>;
  maxRounds?: number;
}

export interface DrainUntilIdleResult {
  processed: number;
  blocked: DrainBlockedInfo | null;
  rounds: number;
}

/** Repeatedly drain until no pending jobs remain or a limit/blocker stops progress. */
export async function drainUntilIdle({
  getSummary,
  drain,
  getConcurrentLimit,
  maxRounds = 200
}: DrainUntilIdleInput): Promise<DrainUntilIdleResult> {
  let processed = 0;
  let rounds = 0;
  let blocked: DrainBlockedInfo | null = null;
  const concurrentLimit = await getConcurrentLimit();

  while (rounds < maxRounds) {
    const summary = await getSummary();
    if (summary.pending <= 0) {
      break;
    }

    rounds += 1;
    const result = await drain(concurrentLimit);
    processed += result.processed;

    if (result.blocked) {
      blocked = result.blocked;
      break;
    }

    if (result.processed === 0) {
      break;
    }
  }

  return { processed, blocked, rounds };
}
