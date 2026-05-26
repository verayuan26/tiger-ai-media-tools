import { describe, expect, it } from 'vitest';
import { getAssetThumbnailUrl, getGeneratedFrameThumbnailUrl } from '../lib/media-url';

describe('getGeneratedFrameThumbnailUrl', () => {
  it('maps POSIX generated frame paths to served media URLs', () => {
    expect(getGeneratedFrameThumbnailUrl('/Users/me/app/.data/frames/asset_1/asset_1-0.jpg')).toBe(
      '/media/frames/asset_1/asset_1-0.jpg'
    );
  });

  it('maps Windows generated frame paths to served media URLs', () => {
    expect(getGeneratedFrameThumbnailUrl('C:\\media\\.data\\frames\\asset 1\\clip #1.jpg')).toBe(
      '/media/frames/asset%201/clip%20%231.jpg'
    );
  });

  it('returns null when a safe generated frame URL cannot be derived', () => {
    expect(getGeneratedFrameThumbnailUrl('/Users/me/app/.data/frames/../secret.jpg')).toBeNull();
  });
});

describe('getAssetThumbnailUrl', () => {
  it('maps generated thumbs paths to served media URLs', () => {
    expect(getAssetThumbnailUrl('asset-1', '/Users/me/app/.data/thumbs/asset_1.jpg')).toBe(
      '/media/thumbs/asset_1.jpg'
    );
  });

  it('falls back to the preview API for source image paths', () => {
    expect(getAssetThumbnailUrl('asset-1', '/Users/me/media/factory_cutting.jpg')).toBe(
      '/api/assets/asset-1/preview'
    );
  });
});
