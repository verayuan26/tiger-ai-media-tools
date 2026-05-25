import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiProvider } from '../ai/provider';
import { createMockAiProvider } from '../ai/mockProvider';
import { openDatabase, type LibraryDatabase } from '../db/connection';
import { createRepositories } from '../db/repositories';
import { drainQueue, processNextJob } from '../jobs/jobRunner';
import type { AnalysisContext } from '../jobs/analysisPipeline';
import type { JobStage, MediaKind } from '../../shared/types';

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

function createTestContext(aiProvider: AiProvider = createMockAiProvider()) {
  tempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-runner-'));
  const db = openDatabase(path.join(tempDir, 'library.sqlite'));
  const repos = createRepositories(db);
  const context: AnalysisContext = {
    repos,
    aiProvider,
    dataDir: path.join(tempDir, 'data'),
    frameMode: 'balanced'
  };

  return { db, repos, context };
}

function closeDb(db: LibraryDatabase) {
  db.close();
}

function createAsset(
  repos: ReturnType<typeof createRepositories>,
  overrides: Partial<{
    fileName: string;
    kind: MediaKind;
    path: string;
    extension: string;
  }> = {}
) {
  const source = repos.sources.upsertSource({ name: 'Factory', rootPath: '/tmp/factory' });
  const fileName = overrides.fileName ?? 'cutting-table.jpg';
  const kind = overrides.kind ?? 'image';

  return repos.assets.upsertAsset({
    sourceId: source.id,
    path: overrides.path ?? `/tmp/factory/${fileName}`,
    fileName,
    kind,
    extension: overrides.extension ?? path.extname(fileName),
    sizeBytes: 12,
    hash: `${fileName}-hash`,
    modifiedAt: '2026-05-25T00:00:00.000Z'
  });
}

describe('job runner', () => {
  it('processes a mock AI vision job and stores cutting tags', async () => {
    const { db, repos, context } = createTestContext();

    try {
      const asset = createAsset(repos);
      repos.jobs.ensureJobs(asset.id, ['ai_vision']);

      await expect(processNextJob(context)).resolves.toBe(true);

      expect(repos.jobs.listForAsset(asset.id)[0]).toMatchObject({
        stage: 'ai_vision',
        status: 'done',
        attempts: 1,
        errorMessage: null
      });
      expect(repos.assets.searchAssets({ tagNames: ['裁剪布料'] }).map((found) => found.id)).toEqual([asset.id]);
      expect(repos.assets.getById(asset.id)).toMatchObject({ status: 'done' });
    } finally {
      closeDb(db);
    }
  });

  it('marks the claimed job and asset failed when AI vision throws', async () => {
    const aiProvider: AiProvider = {
      analyzeImage: vi.fn(async () => {
        throw new Error('vision provider unavailable');
      }),
      transcribeAudio: vi.fn()
    };
    const { db, repos, context } = createTestContext(aiProvider);

    try {
      const asset = createAsset(repos);
      repos.jobs.ensureJobs(asset.id, ['ai_vision']);

      await expect(processNextJob(context)).resolves.toBe(true);

      expect(repos.jobs.listForAsset(asset.id)[0]).toMatchObject({
        status: 'failed',
        attempts: 1,
        errorMessage: 'vision provider unavailable'
      });
      expect(repos.assets.getById(asset.id)).toMatchObject({ status: 'failed' });
    } finally {
      closeDb(db);
    }
  });

  it('drains up to the requested limit and reports no work when the queue is empty', async () => {
    const { db, repos, context } = createTestContext();

    try {
      const firstAsset = createAsset(repos, { fileName: 'cutting-one.jpg', path: '/tmp/factory/cutting-one.jpg' });
      const secondAsset = createAsset(repos, { fileName: 'cutting-two.jpg', path: '/tmp/factory/cutting-two.jpg' });
      repos.jobs.ensureJobs(firstAsset.id, ['thumbnail']);
      repos.jobs.ensureJobs(secondAsset.id, ['thumbnail']);

      await expect(drainQueue(context, 1)).resolves.toBe(1);
      expect(repos.jobs.summary()).toMatchObject({ pending: 1, done: 1 });

      await expect(drainQueue(context, 10)).resolves.toBe(1);
      await expect(processNextJob(context)).resolves.toBe(false);
      await expect(drainQueue(context, 10)).resolves.toBe(0);
    } finally {
      closeDb(db);
    }
  });

  it('skips frame extraction jobs for non-video assets without failing the asset', async () => {
    const { db, repos, context } = createTestContext();

    try {
      const asset = createAsset(repos);
      repos.jobs.ensureJobs(asset.id, ['frames']);

      await expect(processNextJob(context)).resolves.toBe(true);

      expect(repos.jobs.listForAsset(asset.id)[0]).toMatchObject({
        stage: 'frames' satisfies JobStage,
        status: 'skipped',
        attempts: 1,
        errorMessage: null
      });
      expect(repos.frames.listForAsset(asset.id)).toEqual([]);
      expect(repos.assets.getById(asset.id)).toMatchObject({ status: 'done' });
    } finally {
      closeDb(db);
    }
  });
});
