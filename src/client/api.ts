import type {
  AnalysisJob,
  Asset,
  AssetListItem,
  LibrarySource,
  LibrarySourceStats,
  QueueJobListItem,
  QueueSummary,
  TagListItem,
  TagSource,
  TranscriptSegment,
  VideoFrameWithTags
} from '../shared/types';

export interface AssetDetailTag {
  displayName: string;
  confidence: number | null;
  source: TagSource;
}

export interface AssetDetailResponse {
  asset: Asset;
  tags: AssetDetailTag[];
  frames: VideoFrameWithTags[];
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

export async function listSources(): Promise<LibrarySourceStats[]> {
  const response = await request<{ sources: LibrarySourceStats[] }>('/api/sources');
  return response.sources;
}

export async function listTags(): Promise<TagListItem[]> {
  const response = await request<{ tags: TagListItem[] }>('/api/tags');
  return response.tags;
}

export async function createTag(displayName: string, normalizedName?: string): Promise<TagListItem> {
  const response = await request<{ tag: TagListItem }>('/api/tags', {
    method: 'POST',
    body: JSON.stringify({
      displayName,
      ...(normalizedName ? { normalizedName } : {})
    })
  });
  return response.tag;
}

export async function listQueueJobs(limit = 50): Promise<QueueJobListItem[]> {
  const response = await request<{ jobs: QueueJobListItem[] }>(`/api/jobs?limit=${limit}`);
  return response.jobs;
}

export async function listAssets(query: AssetQuery = {}): Promise<AssetListItem[]> {
  const params = new URLSearchParams();

  query.tagNames?.forEach((tagName) => {
    params.append('tag', tagName);
  });
  if (query.query) params.set('q', query.query);
  if (query.transcript) params.set('transcript', query.transcript);

  const path = params.size > 0 ? `/api/assets?${params.toString()}` : '/api/assets';
  const response = await request<{ assets: AssetListItem[] }>(path);
  return response.assets;
}

export async function getAssetDetail(assetId: string): Promise<AssetDetailResponse> {
  return request<AssetDetailResponse>(`/api/assets/${encodeURIComponent(assetId)}`);
}

export async function revealAssetInFileManager(assetId: string): Promise<void> {
  await request<{ ok: boolean }>(`/api/assets/${encodeURIComponent(assetId)}/reveal`, {
    method: 'POST'
  });
}

export async function reanalyzeAsset(assetId: string): Promise<AssetDetailResponse> {
  await request<{ ok: boolean; asset: Asset; jobs: AnalysisJob[] }>(
    `/api/assets/${encodeURIComponent(assetId)}/reanalyze`,
    { method: 'POST' }
  );
  return getAssetDetail(assetId);
}

export async function getQueueSummary(): Promise<QueueSummary> {
  const response = await request<{ summary: QueueSummary }>('/api/queue');
  return response.summary;
}

export async function importSource(
  rootPath: string,
  name: string,
  incrementalScanEnabled = true
): Promise<ImportSourceResponse> {
  return request<ImportSourceResponse>('/api/sources/import', {
    method: 'POST',
    body: JSON.stringify({ rootPath, name, incrementalScanEnabled })
  });
}

export async function updateSource(
  sourceId: string,
  input: { name?: string; rootPath?: string; incrementalScanEnabled?: boolean }
): Promise<LibrarySource> {
  const response = await request<{ source: LibrarySource }>(`/api/sources/${encodeURIComponent(sourceId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input)
  });
  return response.source;
}

export async function deleteSource(sourceId: string): Promise<void> {
  await request<{ ok: boolean }>(`/api/sources/${encodeURIComponent(sourceId)}`, {
    method: 'DELETE'
  });
}

export async function rescanSource(sourceId: string): Promise<ImportSourceResponse> {
  return request<ImportSourceResponse>(`/api/sources/${encodeURIComponent(sourceId)}/rescan`, {
    method: 'POST'
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
