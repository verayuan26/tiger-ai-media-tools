import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

export const GENERATED_CACHE_BUCKETS = ['frames', 'audio', 'thumbs'] as const;

export type GeneratedCacheBucket = (typeof GENERATED_CACHE_BUCKETS)[number];

export interface CacheBucketStats {
  name: GeneratedCacheBucket;
  bytes: number;
  fileCount: number;
}

export interface CacheStats {
  totalBytes: number;
  buckets: CacheBucketStats[];
}

export async function getGeneratedCacheStats(dataDir: string): Promise<CacheStats> {
  const buckets = await Promise.all(
    GENERATED_CACHE_BUCKETS.map(async (name) => summarizeDirectory(path.join(dataDir, name), name))
  );

  return {
    totalBytes: buckets.reduce((sum, bucket) => sum + bucket.bytes, 0),
    buckets
  };
}

export async function clearGeneratedCache(dataDir: string): Promise<CacheStats> {
  for (const bucket of GENERATED_CACHE_BUCKETS) {
    const bucketPath = path.join(dataDir, bucket);
    await rm(bucketPath, { force: true, recursive: true });
  }

  return getGeneratedCacheStats(dataDir);
}

async function summarizeDirectory(
  directoryPath: string,
  name: GeneratedCacheBucket
): Promise<CacheBucketStats> {
  let bytes = 0;
  let fileCount = 0;

  try {
    await walkDirectory(directoryPath, (filePath) => {
      fileCount += 1;
      return stat(filePath).then((fileStat) => {
        if (fileStat.isFile()) {
          bytes += fileStat.size;
        }
      });
    });
  } catch (error) {
    if (!isMissingDirectoryError(error)) {
      throw error;
    }
  }

  return { name, bytes, fileCount };
}

async function walkDirectory(directoryPath: string, onFile: (filePath: string) => Promise<void>): Promise<void> {
  let entries;
  try {
    entries = await readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (isMissingDirectoryError(error)) {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(entryPath, onFile);
      continue;
    }

    if (entry.isFile()) {
      await onFile(entryPath);
    }
  }
}

function isMissingDirectoryError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT');
}
