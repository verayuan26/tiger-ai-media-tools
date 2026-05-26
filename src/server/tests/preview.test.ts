import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveAssetPreviewPath } from '../media/preview';
import type { Asset } from '../../shared/types';

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

function createAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    sourceId: 'source-1',
    path: '/media/factory_cutting.jpg',
    fileName: 'factory_cutting.jpg',
    kind: 'image',
    extension: '.jpg',
    sizeBytes: 100,
    hash: 'hash',
    modifiedAt: '2026-01-01T00:00:00.000Z',
    durationSeconds: null,
    width: null,
    height: null,
    status: 'done',
    thumbnailPath: '/media/factory_cutting.jpg',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('resolveAssetPreviewPath', () => {
  it('resolves generated frame thumbnails under the data directory', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-preview-'));
    const framePath = path.join(tempDir, 'frames', 'asset-1', 'asset-1-0.jpg');
    mkdirSync(path.dirname(framePath), { recursive: true });
    writeFileSync(framePath, 'frame');

    const resolved = resolveAssetPreviewPath({
      asset: createAsset({ kind: 'video', thumbnailPath: framePath }),
      sourceRootPath: '/media',
      dataDir: tempDir,
      frameThumbnailPaths: []
    });

    expect(resolved).toBe(framePath);
  });

  it('falls back to source image paths inside the import root', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-preview-'));
    const sourceRoot = path.join(tempDir, 'factory');
    const imagePath = path.join(sourceRoot, 'factory_cutting.jpg');
    mkdirSync(sourceRoot);
    writeFileSync(imagePath, 'image');

    const resolved = resolveAssetPreviewPath({
      asset: createAsset({ path: imagePath, thumbnailPath: imagePath }),
      sourceRootPath: sourceRoot,
      dataDir: path.join(tempDir, 'data'),
      frameThumbnailPaths: []
    });

    expect(resolved).toBe(imagePath);
  });

  it('rejects paths outside allowed roots', () => {
    const resolved = resolveAssetPreviewPath({
      asset: createAsset({
        kind: 'video',
        path: '/media/factory_tour.mp4',
        thumbnailPath: '/etc/passwd'
      }),
      sourceRootPath: '/media',
      dataDir: '/tmp/data',
      frameThumbnailPaths: []
    });

    expect(resolved).toBeNull();
  });
});
