import type { JOB_STAGES, JOB_STATUSES } from './constants';

export type MediaKind = 'image' | 'video' | 'audio';
export type JobStatus = (typeof JOB_STATUSES)[number];
export type JobStage = (typeof JOB_STAGES)[number];
export type TagSource = 'system' | 'ai' | 'user';
export type TagTargetType = 'asset' | 'frame';

export interface LibrarySource {
  id: string;
  name: string;
  rootPath: string;
  incrementalScanEnabled: boolean;
  lastScannedAt: string | null;
  createdAt: string;
}

export interface Asset {
  id: string;
  sourceId: string;
  path: string;
  fileName: string;
  kind: MediaKind;
  extension: string;
  sizeBytes: number;
  hash: string;
  modifiedAt: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  status: JobStatus;
  thumbnailPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoFrame {
  id: string;
  assetId: string;
  timestampSeconds: number;
  thumbnailPath: string;
  strategy: 'keyframe' | 'interval' | 'precision';
}

export interface TranscriptSegment {
  id: string;
  assetId: string;
  startSeconds: number;
  endSeconds: number;
  language: string;
  text: string;
  translation: string | null;
}

export interface Tag {
  id: string;
  normalizedName: string;
  displayName: string;
  source: TagSource;
}

export interface AssetTag {
  id: string;
  targetType: TagTargetType;
  targetId: string;
  tagId: string;
  confidence: number | null;
}

export interface Collection {
  id: string;
  name: string;
  source: 'manual' | 'ai';
  confirmed: boolean;
  createdAt: string;
}

export interface AnalysisJob {
  id: string;
  assetId: string;
  stage: JobStage;
  status: JobStatus;
  attempts: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetSearchFilters {
  collectionId?: string;
  kinds?: MediaKind[];
  tagNames?: string[];
  transcript?: string;
  query?: string;
}

export interface QueueSummary {
  pending: number;
  processing: number;
  partial: number;
  done: number;
  failed: number;
  skipped: number;
}
