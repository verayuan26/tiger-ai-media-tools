export interface CacheBucketStats {
  name: 'frames' | 'audio' | 'thumbs';
  bytes: number;
  fileCount: number;
}

export interface CacheStats {
  totalBytes: number;
  buckets: CacheBucketStats[];
}
