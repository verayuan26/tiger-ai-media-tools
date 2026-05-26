import type { JobStatus } from '../../shared/types';
import type { DrainBlockedInfo } from '../../shared/settings';
import { processAnalysisJob, type AnalysisContext } from './analysisPipeline';

export interface DrainQueueOptions {
  limit?: number;
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
  let processed = 0;

  while (processed < limit) {
    try {
      const didProcess = await processNextJob(context);
      if (!didProcess) {
        break;
      }
      processed += 1;
    } catch (error) {
      if (error instanceof DrainLimitError) {
        if (context.checkDrainLimits || context.checkJobBudget) {
          return { processed, blocked: error.blocked };
        }
        throw error;
      }
      throw error;
    }
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
