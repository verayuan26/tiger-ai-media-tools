import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Express } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import type { LibraryDatabase } from '../db/connection';

let tempDir: string | null = null;
const apps: Express[] = [];

afterEach(() => {
  while (apps.length > 0) {
    const app = apps.pop();
    (app?.locals.db as LibraryDatabase | undefined)?.close();
  }

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

function createTestApp(dataDir: string): Express {
  const app = createApp({ dataDir, aiProviderName: 'mock' });
  apps.push(app);
  return app;
}

describe('local API server', () => {
  it('returns health status', async () => {
    const { dataDir } = createTempSource();
    const app = createTestApp(dataDir);

    await request(app).get('/api/health').expect(200, { ok: true });
  });

  it('imports image assets, drains analysis, searches by tag, and returns asset detail', async () => {
    const { dataDir, sourceDir } = createTempSource();
    const app = createTestApp(dataDir);

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
    const app = createTestApp(dataDir);

    await request(app).get('/api/assets/missing-asset').expect(404);
  });

  it('returns changed count when retrying failed jobs', async () => {
    const { dataDir } = createTempSource();
    const app = createTestApp(dataDir);

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

  it('does not emit CORS allow-origin for disallowed origins', async () => {
    const { dataDir } = createTempSource();
    const app = createTestApp(dataDir);

    const response = await request(app).get('/api/health').set('Origin', 'https://example.com').expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not serve the SQLite database through media routes', async () => {
    const { dataDir } = createTempSource();
    const app = createTestApp(dataDir);

    await request(app).get('/media/library.sqlite').expect(404);
  });

  it('rejects whitespace-only import payload fields with 400', async () => {
    const { dataDir } = createTempSource();
    const app = createTestApp(dataDir);

    const response = await request(app)
      .post('/api/sources/import')
      .send({ rootPath: '   ', name: '   ' })
      .expect(400);

    expect(response.body.error.message).toBe('Invalid request');
  });
});
