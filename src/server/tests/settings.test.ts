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

function createTestApp(dataDir: string): Express {
  const app = createApp({ dataDir, aiProviderName: 'mock' });
  apps.push(app);
  return app;
}

function createTempSource() {
  tempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-settings-'));
  const sourceDir = path.join(tempDir, 'factory');
  mkdirSync(sourceDir);
  writeFileSync(path.join(sourceDir, 'factory_cutting.jpg'), 'fake image bytes');
  return { dataDir: tempDir, sourceDir };
}

describe('settings API', () => {
  it('returns default settings and persists patches across requests', async () => {
    const { dataDir } = createTempSource();
    const app = createTestApp(dataDir);

    const initial = await request(app).get('/api/settings').expect(200);
    expect(initial.body.settings).toMatchObject({
      aiProviderName: 'mock',
      dailyBudgetYuan: 50,
      concurrentTasks: 3,
      apiKeyConfigured: false,
      transcriptionMode: 'auto',
      fallbackTranscribeProvider: 'dashscope-asr',
      fallbackTranscribeEndpoint: 'https://dashscope.aliyuncs.com/api/v1',
      fallbackTranscribeModel: 'qwen3-asr-flash-filetrans',
      fallbackTranscribeApiKeyConfigured: false
    });

    const patched = await request(app)
      .patch('/api/settings')
      .send({
        aiProviderName: 'openai-compatible',
        dailyBudgetYuan: 30,
        concurrentTasks: 2,
        apiEndpoint: 'https://example.com/v1',
        apiKey: 'sk-test-key',
        openAiVisionModel: 'gpt-4o-mini',
        openAiTranscribeModel: 'whisper-1',
        transcriptionMode: 'auto',
        fallbackTranscribeProvider: 'dashscope-asr',
        fallbackTranscribeEndpoint: 'https://dashscope.aliyuncs.com/api/v1',
        fallbackTranscribeModel: 'qwen3-asr-flash-filetrans',
        fallbackTranscribeApiKey: 'sk-dashscope'
      })
      .expect(200);

    expect(patched.body.settings).toMatchObject({
      dailyBudgetYuan: 30,
      concurrentTasks: 2,
      apiEndpoint: 'https://example.com/v1',
      apiKeyConfigured: true,
      openAiVisionModel: 'gpt-4o-mini',
      openAiTranscribeModel: 'whisper-1',
      transcriptionMode: 'auto',
      fallbackTranscribeProvider: 'dashscope-asr',
      fallbackTranscribeEndpoint: 'https://dashscope.aliyuncs.com/api/v1',
      fallbackTranscribeModel: 'qwen3-asr-flash-filetrans',
      fallbackTranscribeApiKeyConfigured: true
    });

    const reloaded = await request(app).get('/api/settings').expect(200);
    expect(reloaded.body.settings).toMatchObject({
      dailyBudgetYuan: 30,
      concurrentTasks: 2,
      apiKeyConfigured: true
    });
  });

  it('rejects openai-compatible test when vision or transcribe model is missing', async () => {
    const { dataDir } = createTempSource();
    const app = createTestApp(dataDir);

    const response = await request(app)
      .post('/api/settings/test-ai')
      .send({
        aiProviderName: 'openai-compatible',
        apiEndpoint: 'https://example.com/v1',
        apiKey: 'sk-test-key',
        openAiVisionModel: 'gpt-4o-mini'
      })
      .expect(400);

    expect(response.body).toMatchObject({
      ok: false,
      provider: 'openai-compatible',
      message: expect.stringContaining('AI_OPENAI_TRANSCRIBE_MODEL')
    });
  });

  it('reports generated cache size and clears cache buckets', async () => {
    const { dataDir } = createTempSource();
    const app = createTestApp(dataDir);
    const framesDir = path.join(dataDir, 'frames', 'asset-a');
    mkdirSync(framesDir, { recursive: true });
    writeFileSync(path.join(framesDir, 'frame.jpg'), '12345');

    const statsResponse = await request(app).get('/api/system/cache').expect(200);
    expect(statsResponse.body.cache).toMatchObject({
      totalBytes: 5,
      buckets: expect.arrayContaining([
        expect.objectContaining({ name: 'frames', bytes: 5, fileCount: 1 })
      ])
    });

    const clearResponse = await request(app).post('/api/system/cache/clear').expect(200);
    expect(clearResponse.body.cache.totalBytes).toBe(0);

    const afterClear = await request(app).get('/api/system/cache').expect(200);
    expect(afterClear.body.cache.totalBytes).toBe(0);
  });

  it('tests mock AI connectivity without calling external APIs', async () => {
    const { dataDir } = createTempSource();
    const app = createTestApp(dataDir);

    const response = await request(app)
      .post('/api/settings/test-ai')
      .send({ aiProviderName: 'mock' })
      .expect(200);

    expect(response.body).toMatchObject({ ok: true, provider: 'mock' });
  });

  it('rejects drain when concurrent task limit is reached', async () => {
    const { dataDir, sourceDir } = createTempSource();
    const app = createTestApp(dataDir);

    await request(app).patch('/api/settings').send({ concurrentTasks: 1 }).expect(200);

    await request(app)
      .post('/api/sources/import')
      .send({ rootPath: sourceDir, name: 'Factory' })
      .expect(200);

    const db = app.locals.db as LibraryDatabase;
    db.prepare(
      `update analysis_jobs
       set status = 'processing', updated_at = ?
       where id = (select id from analysis_jobs where status = 'pending' limit 1)`
    ).run(new Date().toISOString());

    const drainResponse = await request(app).post('/api/jobs/drain').send({ limit: 5 }).expect(429);

    expect(drainResponse.body.blocked).toMatchObject({
      code: 'concurrent_limit_reached'
    });
  });
});
