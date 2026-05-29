import type { JobStatus } from '../../shared/types';
import type { DrainBlockedInfo } from '../../shared/settings';
import { processAnalysisJob, type AnalysisContext } from './analysisPipeline';

export interface DrainQueueOptions {
  limit?: number;
  /** Max jobs to run in parallel per drain batch; defaults to 1. */
  maxConcurrent?: number;
  checkLimits?: (processingCount: number) => DrainBlockedInfo | null;
  checkJobBudget?: AnalysisContext['checkJobBudget'];
  onAiJobCompleted?: AnalysisContext['onAiJobCompleted'];
}

export interface DrainQueueResult {
  processed: number;
  blocked: DrainBlockedInfo | null;
}

export async function processNextJob(context: AnalysisContext): Promise<boolean> {
  const processingCount = context.repos.jobs.summary().processing;
  const blocked = context.checkDrainLimits?.(processingCount) ?? null;
  if (blocked) {
    throw new DrainLimitError(blocked);
  }

  const job = context.repos.jobs.claimNextPending();
  if (!job) {
    return false;
  }

  const jobBlocked = context.checkJobBudget?.(job) ?? null;
  if (jobBlocked) {
    context.repos.jobs.updateStatus(job.id, 'pending');
    throw new DrainLimitError(jobBlocked);
  }

  try {
    const result = await processAnalysisJob(job, context);
    context.repos.jobs.updateStatus(job.id, result.status);
    context.onAiJobCompleted?.(job);
    markAssetDoneWhenAnalysisComplete(job.assetId, context);
  } catch (error) {
    context.repos.jobs.updateStatus(job.id, 'failed', getErrorMessage(error));
    context.repos.assets.setMetadata(job.assetId, { status: 'failed' });
  }

  return true;
}

export async function drainQueue(
  context: AnalysisContext,
  limitOrOptions: number | DrainQueueOptions = 25
): Promise<number | DrainQueueResult> {
  const options = typeof limitOrOptions === 'number' ? { limit: limitOrOptions } : limitOrOptions;
  const limit = options.limit ?? 25;
  const maxConcurrent = Math.max(1, options.maxConcurrent ?? 1);
  let processed = 0;

  while (processed < limit) {
    const summary = context.repos.jobs.summary();
    const blockedBeforeBatch = context.checkDrainLimits?.(summary.processing) ?? null;
    if (blockedBeforeBatch) {
      if (context.checkDrainLimits || context.checkJobBudget) {
        return { processed, blocked: blockedBeforeBatch };
      }
      throw new DrainLimitError(blockedBeforeBatch);
    }

    if (summary.pending === 0) {
      break;
    }

    const slots = Math.min(maxConcurrent - summary.processing, limit - processed, summary.pending);
    if (slots <= 0) {
      break;
    }

    const outcomes = await Promise.all(
      Array.from({ length: slots }, async () => {
        try {
          return await processNextJob(context);
        } catch (error) {
          if (error instanceof DrainLimitError) {
            return error;
          }
          throw error;
        }
      })
    );

    let batchProcessed = 0;
    for (const outcome of outcomes) {
      if (outcome instanceof DrainLimitError) {
        if (context.checkDrainLimits || context.checkJobBudget) {
          return { processed, blocked: outcome.blocked };
        }
        throw outcome;
      }
      if (outcome) {
        batchProcessed += 1;
      }
    }

    if (batchProcessed === 0) {
      break;
    }

    processed += batchProcessed;
  }

  if (context.checkDrainLimits || context.checkJobBudget) {
    return { processed, blocked: null };
  }

  return processed;
}

export class DrainLimitError extends Error {
  constructor(public readonly blocked: DrainBlockedInfo) {
    super(blocked.message);
    this.name = 'DrainLimitError';
  }
}

function markAssetDoneWhenAnalysisComplete(assetId: string, context: AnalysisContext): void {
  const jobs = context.repos.jobs.listForAsset(assetId);
  const terminalStatuses = new Set<JobStatus>(['done', 'skipped']);
  if (jobs.length > 0 && jobs.every((job) => terminalStatuses.has(job.status))) {
    context.repos.assets.setMetadata(assetId, { status: 'done' });
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
