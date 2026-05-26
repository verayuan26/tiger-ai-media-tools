export type FileType = 'video' | 'image' | 'audio';

export type AssetStatus = 'pending' | 'processing' | 'partial' | 'done' | 'failed' | 'skipped';

export type TagSource = 'system' | 'ai' | 'user';

export interface Tag {
  id: string;
  name: string;
  type: TagSource;
  confidence?: number;
}

export interface VideoFrame {
  id: string;
  timestamp: number;
  thumbnailUrl: string;
  tags: Tag[];
}

export interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  language: string;
  text: string;
  translation?: string;
}

export interface Asset {
  id: string;
  path: string;
  fileName: string;
  fileType: FileType;
  size: number;
  duration?: number;
  thumbnailUrl: string;
  status: AssetStatus;
  tags: Tag[];
  frames?: VideoFrame[];
  transcripts?: TranscriptSegment[];
  createdAt: Date;
  modifiedAt: Date;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  assetCount: number;
  isAiRecommended: boolean;
}

export interface LibrarySource {
  id: string;
  path: string;
  name: string;
  lastScanned?: Date;
  assetCount: number;
  isMonitoring: boolean;
}

export interface AnalysisJob {
  id: string;
  assetId: string;
  stage: string;
  status: AssetStatus;
  progress: number;
  error?: string;
}
