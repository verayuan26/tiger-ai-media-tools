import { describe, expect, it } from 'vitest';
import { getGeneratedFrameThumbnailUrl } from './AssetGrid';

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
    expect(getGeneratedFrameThumbnailUrl('/Users/me/app/.data/thumbs/asset_1.jpg')).toBeNull();
    expect(getGeneratedFrameThumbnailUrl('/Users/me/app/.data/frames/../secret.jpg')).toBeNull();
  });
});
