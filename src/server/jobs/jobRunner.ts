import type { JobStatus } from '../../shared/types';
import { processAnalysisJob, type AnalysisContext } from './analysisPipeline';

export async function processNextJob(context: AnalysisContext): Promise<boolean> {
  const job = context.repos.jobs.claimNextPending();
  if (!job) {
    return false;
  }

  try {
    const result = await processAnalysisJob(job, context);
    context.repos.jobs.updateStatus(job.id, result.status);
    markAssetDoneWhenAnalysisComplete(job.assetId, context);
  } catch (error) {
    context.repos.jobs.updateStatus(job.id, 'failed', getErrorMessage(error));
    context.repos.assets.setMetadata(job.assetId, { status: 'failed' });
  }

  return true;
}

export async function drainQueue(context: AnalysisContext, limit = 25): Promise<number> {
  let processed = 0;

  while (processed < limit) {
    const didProcess = await processNextJob(context);
    if (!didProcess) {
      break;
    }
    processed += 1;
  }

  return processed;
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
