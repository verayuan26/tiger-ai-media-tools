import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { clearGeneratedCache, getGeneratedCacheStats } from '../media/cacheStorage';

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('cacheStorage', () => {
  it('summarizes generated cache buckets and clears them', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'ai-media-cache-'));
    const framesDir = path.join(tempDir, 'frames', 'asset-a');
    await mkdir(framesDir, { recursive: true });
    await writeFile(path.join(framesDir, 'frame.jpg'), '12345');

    const stats = await getGeneratedCacheStats(tempDir);
    expect(stats).toMatchObject({
      totalBytes: 5,
      buckets: expect.arrayContaining([
        expect.objectContaining({ name: 'frames', bytes: 5, fileCount: 1 })
      ])
    });

    const cleared = await clearGeneratedCache(tempDir);
    expect(cleared.totalBytes).toBe(0);

    const afterClear = await getGeneratedCacheStats(tempDir);
    expect(afterClear.totalBytes).toBe(0);
  });
});
