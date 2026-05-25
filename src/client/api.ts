import type {
  AnalysisJob,
  Asset,
  LibrarySource,
  QueueSummary,
  Tag,
  TranscriptSegment,
  VideoFrame
} from '../shared/types';

export interface AssetDetailResponse {
  asset: Asset;
  tags: Tag[];
  frames: VideoFrame[];
  transcripts: TranscriptSegment[];
  jobs: AnalysisJob[];
}

export interface ImportSourceResponse {
  sourceId: string;
  indexed: number;
  skipped: number;
}

export interface DrainJobsResponse {
  processed: number;
  summary: QueueSummary;
}

export interface RetryFailedResponse {
  changed: number;
  summary: QueueSummary;
}

export interface AssetQuery {
  tagNames?: string[];
  query?: string;
  transcript?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly issues?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function listSources(): Promise<LibrarySource[]> {
  const response = await request<{ sources: LibrarySource[] }>('/api/sources');
  return response.sources;
}

export async function listAssets(query: AssetQuery = {}): Promise<Asset[]> {
  const params = new URLSearchParams();

  query.tagNames?.forEach((tagName) => {
    params.append('tag', tagName);
  });
  if (query.query) params.set('q', query.query);
  if (query.transcript) params.set('transcript', query.transcript);

  const path = params.size > 0 ? `/api/assets?${params.toString()}` : '/api/assets';
  const response = await request<{ assets: Asset[] }>(path);
  return response.assets;
}

export async function getAssetDetail(assetId: string): Promise<AssetDetailResponse> {
  return request<AssetDetailResponse>(`/api/assets/${encodeURIComponent(assetId)}`);
}

export async function getQueueSummary(): Promise<QueueSummary> {
  const response = await request<{ summary: QueueSummary }>('/api/queue');
  return response.summary;
}

export async function importSource(rootPath: string, name: string): Promise<ImportSourceResponse> {
  return request<ImportSourceResponse>('/api/sources/import', {
    method: 'POST',
    body: JSON.stringify({ rootPath, name })
  });
}

export async function drainJobs(limit = 10): Promise<DrainJobsResponse> {
  return request<DrainJobsResponse>('/api/jobs/drain', {
    method: 'POST',
    body: JSON.stringify({ limit })
  });
}

export async function retryFailed(assetId?: string): Promise<RetryFailedResponse> {
  return request<RetryFailedResponse>('/api/jobs/retry-failed', {
    method: 'POST',
    body: JSON.stringify(assetId ? { assetId } : {})
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers
    }
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    throw createApiError(payload, response.status);
  }

  return payload as T;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    if (!response.ok) {
      throw new ApiError(text, response.status);
    }

    throw new ApiError('API returned invalid JSON', response.status);
  }
}

function createApiError(payload: unknown, status: number): ApiError {
  if (isNestedApiError(payload)) {
    return new ApiError(payload.error.message, status, payload.error.issues);
  }

  if (typeof payload === 'string' && payload.trim().length > 0) {
    return new ApiError(payload, status);
  }

  return new ApiError(`Request failed with status ${status}`, status);
}

function isNestedApiError(payload: unknown): payload is { error: { message: string; issues?: unknown } } {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) return false;

  const error = (payload as { error: unknown }).error;
  return Boolean(error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string');
}
