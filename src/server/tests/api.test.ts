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

  it('filters assets with repeated tag query params', async () => {
    const { dataDir, sourceDir } = createTempSource();
    const app = createTestApp(dataDir);

    await request(app).post('/api/sources/import').send({ rootPath: sourceDir, name: 'Factory' }).expect(200);
    await request(app).post('/api/jobs/drain').send({ limit: 5 }).expect(200);

    const response = await request(app)
      .get('/api/assets')
      .query({ tag: ['裁剪布料', '牛仔布'] })
      .expect(200);

    expect(response.body.assets).toHaveLength(1);
    expect(response.body.assets[0]).toMatchObject({ fileName: 'factory_cutting.jpg' });
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

  it('drains jobs with the default limit when posting no body and no content type', async () => {
    const { dataDir, sourceDir } = createTempSource();
    const app = createTestApp(dataDir);

    await request(app).post('/api/sources/import').send({ rootPath: sourceDir, name: 'Factory' }).expect(200);

    const drainResponse = await request(app).post('/api/jobs/drain').expect(200);

    expect(drainResponse.body.processed).toBe(3);
  });

  it('retries failed jobs when posting no body and no content type', async () => {
    const { dataDir } = createTempSource();
    const app = createTestApp(dataDir);

    const retryResponse = await request(app).post('/api/jobs/retry-failed').expect(200);

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
  });

  it('rejects text drain posts from disallowed origins without processing jobs', async () => {
    const { dataDir, sourceDir } = createTempSource();
    const app = createTestApp(dataDir);

    await request(app).post('/api/sources/import').send({ rootPath: sourceDir, name: 'Factory' }).expect(200);

    await request(app)
      .post('/api/jobs/drain')
      .set('Origin', 'https://example.com')
      .set('Content-Type', 'text/plain')
      .send('limit=5')
      .expect(403);

    const drainResponse = await request(app)
      .post('/api/jobs/drain')
      .set('Origin', 'http://localhost:5173')
      .send({ limit: 5 })
      .expect(200);

    expect(drainResponse.body.processed).toBe(3);
  });

  it('drains jobs for allowed origins with a JSON body', async () => {
    const { dataDir, sourceDir } = createTempSource();
    const app = createTestApp(dataDir);

    await request(app).post('/api/sources/import').send({ rootPath: sourceDir, name: 'Factory' }).expect(200);

    const drainResponse = await request(app)
      .post('/api/jobs/drain')
      .set('Origin', 'http://127.0.0.1:5173')
      .send({ limit: 5 })
      .expect(200);

    expect(drainResponse.body.processed).toBe(3);
  });

  it('rejects text drain posts without an origin and without processing jobs', async () => {
    const { dataDir, sourceDir } = createTempSource();
    const app = createTestApp(dataDir);

    await request(app).post('/api/sources/import').send({ rootPath: sourceDir, name: 'Factory' }).expect(200);

    const response = await request(app)
      .post('/api/jobs/drain')
      .set('Content-Type', 'text/plain')
      .send('limit=5')
      .expect(415);

    expect(response.body).toEqual({ error: { message: 'JSON request body required' } });

    const drainResponse = await request(app).post('/api/jobs/drain').send({ limit: 5 }).expect(200);

    expect(drainResponse.body.processed).toBe(3);
  });

  it('does not emit CORS allow-origin for disallowed origins', async () => {
    const { dataDir } = createTempSource();
    const app = createTestApp(dataDir);

    const response = await request(app).get('/api/health').set('Origin', 'https://example.com').expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it.each(['http://127.0.0.1:5173', 'http://localhost:5173'])(
    'emits CORS allow-origin for allowed Vite origin %s',
    async (origin) => {
      const { dataDir } = createTempSource();
      const app = createTestApp(dataDir);

      const response = await request(app).get('/api/health').set('Origin', origin).expect(200);

      expect(response.headers['access-control-allow-origin']).toBe(origin);
    }
  );

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

  it('returns 400 JSON error for malformed JSON bodies', async () => {
    const { dataDir } = createTempSource();
    const app = createTestApp(dataDir);

    const response = await request(app)
      .post('/api/sources/import')
      .set('Content-Type', 'application/json')
      .send('{"rootPath":')
      .expect(400);

    expect(response.body).toEqual({ error: { message: 'Invalid JSON body' } });
  });

  it('returns 413 JSON error for oversized JSON bodies', async () => {
    const { dataDir } = createTempSource();
    const app = createTestApp(dataDir);

    const response = await request(app)
      .post('/api/sources/import')
      .send({ rootPath: 'x'.repeat(2 * 1024 * 1024), name: 'Factory' })
      .expect(413);

    expect(response.body).toEqual({ error: { message: 'Request body too large' } });
  });
});
