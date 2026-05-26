import path from 'node:path';
import {
  SUPPORTED_AUDIO_EXTENSIONS,
  SUPPORTED_IMAGE_EXTENSIONS,
  SUPPORTED_VIDEO_EXTENSIONS
} from '../../shared/constants';
import type { Asset } from '../../shared/types';

export function resolveGeneratedMediaPath(
  filePath: string,
  dataDir: string,
  bucket: 'frames' | 'thumbs'
): string | null {
  const resolvedDataDir = path.resolve(dataDir);
  const resolvedFile = path.resolve(filePath);
  const bucketRoot = path.join(resolvedDataDir, bucket);

  if (resolvedFile !== bucketRoot && !resolvedFile.startsWith(`${bucketRoot}${path.sep}`)) {
    return null;
  }

  return resolvedFile;
}

export function isImagePreviewPath(filePath: string): boolean {
  return SUPPORTED_IMAGE_EXTENSIONS.includes(path.extname(filePath).toLowerCase() as (typeof SUPPORTED_IMAGE_EXTENSIONS)[number]);
}

export function isStreamableMediaPath(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return (
    SUPPORTED_IMAGE_EXTENSIONS.includes(extension as (typeof SUPPORTED_IMAGE_EXTENSIONS)[number]) ||
    SUPPORTED_VIDEO_EXTENSIONS.includes(extension as (typeof SUPPORTED_VIDEO_EXTENSIONS)[number]) ||
    SUPPORTED_AUDIO_EXTENSIONS.includes(extension as (typeof SUPPORTED_AUDIO_EXTENSIONS)[number])
  );
}

/** Resolves the on-disk source file for browser playback (video/audio/image). */
export function resolveAssetMediaPath(input: {
  asset: Asset;
  sourceRootPath: string | null;
}): string | null {
  if (!input.sourceRootPath) return null;

  const sourcePath = resolveSourceAssetPath(input.asset.path, input.sourceRootPath);
  if (!sourcePath || !isStreamableMediaPath(sourcePath)) {
    return null;
  }

  return sourcePath;
}

export function resolveSourceAssetPath(assetPath: string, sourceRootPath: string): string | null {
  const resolvedSourceRoot = path.resolve(sourceRootPath);
  const resolvedAssetPath = path.resolve(assetPath);

  if (resolvedAssetPath !== resolvedSourceRoot && !resolvedAssetPath.startsWith(`${resolvedSourceRoot}${path.sep}`)) {
    return null;
  }

  return resolvedAssetPath;
}

export function resolveAssetPreviewPath(input: {
  asset: Asset;
  sourceRootPath: string | null;
  dataDir: string;
  frameThumbnailPaths: string[];
}): string | null {
  const candidates = [
    input.asset.thumbnailPath,
    ...input.frameThumbnailPaths,
    input.asset.kind === 'image' ? input.asset.path : null
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    for (const bucket of ['frames', 'thumbs'] as const) {
      const generated = resolveGeneratedMediaPath(candidate, input.dataDir, bucket);
      if (generated && isImagePreviewPath(generated)) {
        return generated;
      }
    }

    if (input.sourceRootPath) {
      const sourcePath = resolveSourceAssetPath(candidate, input.sourceRootPath);
      if (sourcePath && isImagePreviewPath(sourcePath)) {
        return sourcePath;
      }
    }
  }

  return null;
}
