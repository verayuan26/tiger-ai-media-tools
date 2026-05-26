type GeneratedMediaBucket = 'frames' | 'thumbs';

function getGeneratedMediaUrl(thumbnailPath: string | null, bucket: GeneratedMediaBucket): string | null {
  if (!thumbnailPath) return null;

  const pathSegments = thumbnailPath.split(/[\\/]+/);
  const bucketIndex = pathSegments.lastIndexOf(bucket);
  if (bucketIndex === -1) return null;

  const mediaSegments = pathSegments.slice(bucketIndex + 1);
  if (mediaSegments.length === 0 || mediaSegments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return null;
  }

  return `/media/${bucket}/${mediaSegments.map(encodeURIComponent).join('/')}`;
}

/** Maps on-disk frame paths to served `/media/frames/...` URLs. */
export function getGeneratedFrameThumbnailUrl(thumbnailPath: string | null): string | null {
  return getGeneratedMediaUrl(thumbnailPath, 'frames');
}

/** Read-only stream URL for the original asset file (video/audio/image). */
export function getAssetMediaUrl(assetId: string): string {
  return `/api/assets/${encodeURIComponent(assetId)}/media`;
}

/** Maps asset thumbnail paths to a browser-loadable preview URL. */
export function getAssetThumbnailUrl(assetId: string, thumbnailPath: string | null): string | null {
  const generated =
    getGeneratedFrameThumbnailUrl(thumbnailPath) ?? getGeneratedMediaUrl(thumbnailPath, 'thumbs');
  if (generated) return generated;
  if (!thumbnailPath) return null;
  return `/api/assets/${encodeURIComponent(assetId)}/preview`;
}
