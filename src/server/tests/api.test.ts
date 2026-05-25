import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

function createTempSource() {
  tempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-api-'));
  const sourceDir = path.join(tempDir, 'factory');
  mkdirSync(sourceDir);
  writeFileSync(path.join(sourceDir, 'factory_cutting.jpg'), 'fake image bytes');
  return { dataDir: tempDir, sourceDir };
}

describe('local API server', () => {
  it('returns health status', async () => {
    const { dataDir } = createTempSource();
    const app = createApp({ dataDir, aiProviderName: 'mock' });

    await request(app).get('/api/health').expect(200, { ok: true });
  });

  it('imports image assets, drains analysis, searches by tag, and returns asset detail', async () => {
    const { dataDir, sourceDir } = createTempSource();
    const app = createApp({ dataDir, aiProviderName: 'mock' });

    const importResponse = await request(app)
      .post('/api/sources/import')
      .send({ rootPath: sourceDir, name: 'Factory' })
      .expect(200);

    expect(importResponse.body).toMatchObject({ indexed: 1, skipped: 0 });

    const drainResponse = await request(app).post('/api/jobs/drain').send({ limit: 5 }).expect(200);

    expect(drainResponse.body.processed).toBe(3);

    const searchResponse = await request(app).get('/api/assets').query({ tag: '裁剪布料' }).expect(200);

    expect(searchResponse.body.assets).toHaveLength(1);
    expect(searchResponse.body.assets[0]).toMatchObject({ fileName: 'factory_cutting.jpg' });

    const detailResponse = await request(app).get(`/api/assets/${searchResponse.body.assets[0].id}`).expect(200);

    expect(detailResponse.body.asset).toMatchObject({ fileName: 'factory_cutting.jpg' });
    expect(detailResponse.body.tags[0]).toMatchObject({
      displayName: '裁剪布料',
      confidence: 0.88,
      source: 'ai'
    });
    expect(detailResponse.body.frames).toEqual([]);
    expect(detailResponse.body.transcripts).toEqual([]);
    expect(detailResponse.body.jobs).toHaveLength(3);
  });

  it('returns 404 for missing asset detail', async () => {
    const { dataDir } = createTempSource();
    const app = createApp({ dataDir, aiProviderName: 'mock' });

    await request(app).get('/api/assets/missing-asset').expect(404);
  });

  it('returns changed count when retrying failed jobs', async () => {
    const { dataDir } = createTempSource();
    const app = createApp({ dataDir, aiProviderName: 'mock' });

    const retryResponse = await request(app).post('/api/jobs/retry-failed').send({}).expect(200);

    expect(retryResponse.body).toMatchObject({
      changed: 0,
      summary: {
        pending: 0,
        processing: 0,
        partial: 0,
        done: 0,
        failed: 0,
        skipped: 0
      }
    });
    expect(retryResponse.body).not.toHaveProperty('retried');
  });
});
