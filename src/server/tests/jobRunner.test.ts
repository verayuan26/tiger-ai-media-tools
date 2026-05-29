import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiProvider } from '../ai/provider';
import { createMockAiProvider } from '../ai/mockProvider';
import { openDatabase, type LibraryDatabase } from '../db/connection';
import { createRepositories } from '../db/repositories';
import { drainQueue, processNextJob } from '../jobs/jobRunner';
import type { AnalysisContext } from '../jobs/analysisPipeline';
import type { JobStage, MediaKind } from '../../shared/types';

const mediaMock = vi.hoisted(() => ({
  extractAudioTrack: vi.fn(async ({ outputPath }: { outputPath: string }) => outputPath),
  ensureTranscriptionAudioFile: vi.fn(
    async ({
      asset,
      dataDir
    }: {
      asset: { id: string; kind: 'image' | 'video' | 'audio'; path: string };
      dataDir: string;
    }) => {
      const { transcriptionAudioPath } = await import('../media/ffmpeg');
      return transcriptionAudioPath(dataDir, asset.id);
    }
  ),
  extractVideoFrames: vi.fn(),
  probeMedia: vi.fn()
}));

vi.mock('../media/ffmpeg', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../media/ffmpeg')>();
  return {
    ...actual,
    extractAudioTrack: mediaMock.extractAudioTrack,
    ensureTranscriptionAudioFile: mediaMock.ensureTranscriptionAudioFile,
    extractVideoFrames: mediaMock.extractVideoFrames,
    probeMedia: mediaMock.probeMedia
  };
});

let tempDir: string | null = null;

beforeEach(() => {
  mediaMock.extractAudioTrack.mockReset();
  mediaMock.extractAudioTrack.mockImplementation(async ({ outputPath }: { outputPath: string }) => outputPath);
  mediaMock.ensureTranscriptionAudioFile.mockReset();
  mediaMock.ensureTranscriptionAudioFile.mockImplementation(
    async ({
      asset,
      dataDir
    }: {
      asset: { id: string; kind: 'image' | 'video' | 'audio'; path: string };
      dataDir: string;
    }) => {
      const { transcriptionAudioPath } = await import('../media/ffmpeg');
      return transcriptionAudioPath(dataDir, asset.id);
    }
  );
  mediaMock.extractVideoFrames.mockReset();
  mediaMock.probeMedia.mockReset();
});

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

  it('replaces stale AI vision tags on rerun while preserving user tags', async () => {
    const aiProvider: AiProvider = {
      analyzeImage: vi
        .fn()
        .mockResolvedValueOnce({ tags: [{ displayName: '旧AI标签', confidence: 0.7 }] })
        .mockResolvedValueOnce({ tags: [{ displayName: '新AI标签', confidence: 0.91 }] }),
      transcribeAudio: vi.fn()
    };
    const { db, repos, context } = createTestContext(aiProvider);

    try {
      const asset = createAsset(repos);
      repos.tags.assignAssetTag(asset.id, '人工保留', 'user', null);
      repos.jobs.ensureJobs(asset.id, ['ai_vision']);

      await expect(processNextJob(context)).resolves.toBe(true);
      expect(repos.assets.searchAssets({ tagNames: ['旧AI标签'] }).map((found) => found.id)).toEqual([asset.id]);

      repos.jobs.resetJobs(asset.id, ['ai_vision']);
      await expect(processNextJob(context)).resolves.toBe(true);

      expect(repos.assets.searchAssets({ tagNames: ['旧AI标签'] })).toEqual([]);
      expect(repos.assets.searchAssets({ tagNames: ['新AI标签'] }).map((found) => found.id)).toEqual([asset.id]);
      expect(repos.assets.searchAssets({ tagNames: ['人工保留'] }).map((found) => found.id)).toEqual([asset.id]);
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

  it('processes video analysis stages in dependency order', async () => {
    const calls: string[] = [];
    const aiProvider: AiProvider = {
      analyzeImage: vi.fn(async ({ imagePath }) => {
        calls.push('ai_vision');
        return {
          tags: imagePath.includes('cutting')
            ? [{ displayName: '裁剪布料', confidence: 0.88 }]
            : [{ displayName: '缝纫机', confidence: 0.9 }]
        };
      }),
      transcribeAudio: vi.fn(async () => {
        calls.push('ai_transcript');
        return { segments: [] };
      })
    };
    const { db, repos, context } = createTestContext(aiProvider);

    try {
      mediaMock.probeMedia.mockImplementation(async () => {
        calls.push('metadata');
        return { durationSeconds: 30, width: 1920, height: 1080 };
      });
      mediaMock.extractVideoFrames.mockImplementation(async () => {
        calls.push('frames');
        return [{ timestampSeconds: 0, thumbnailPath: '/tmp/factory-tour-0.jpg' }];
      });
      const asset = createAsset(repos, {
        fileName: 'factory-tour.mp4',
        kind: 'video',
        path: '/tmp/factory/factory-tour.mp4',
        extension: '.mp4'
      });
      repos.jobs.ensureJobs(asset.id, ['ai_vision', 'frames', 'thumbnail', 'ai_transcript', 'audio', 'metadata']);

      await expect(drainQueue(context, 10)).resolves.toBe(6);

      expect(calls).toEqual(['metadata', 'frames', 'ai_vision', 'ai_vision', 'ai_transcript']);
      expect(mediaMock.extractAudioTrack).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: '/tmp/factory/factory-tour.mp4'
        })
      );
      expect(mediaMock.extractVideoFrames).toHaveBeenCalledWith(
        expect.objectContaining({
          assetId: asset.id,
          durationSeconds: 30,
          filePath: '/tmp/factory/factory-tour.mp4',
          mode: 'balanced'
        })
      );
      expect(repos.jobs.listForAsset(asset.id).map((job) => job.stage)).toEqual([
        'metadata',
        'thumbnail',
        'frames',
        'audio',
        'ai_vision',
        'ai_transcript'
      ]);
      expect(repos.jobs.listForAsset(asset.id).map((job) => job.status)).toEqual([
        'done',
        'done',
        'done',
        'done',
        'done',
        'done'
      ]);
      const frames = repos.frames.listForAsset(asset.id);
      expect(frames).toHaveLength(1);
      const frameTags = repos.tags.listForFrames(frames.map((frame) => frame.id));
      expect(frameTags.get(frames[0].id)).toEqual([{ displayName: '缝纫机' }]);
    } finally {
      closeDb(db);
    }
  });

  it('does not start transcription while audio extraction is still running concurrently', async () => {
    let releaseAudio: (() => void) | undefined;
    const audioStarted = new Promise<void>((resolve) => {
      mediaMock.extractAudioTrack.mockImplementation(async ({ outputPath }: { outputPath: string }) => {
        resolve();
        await new Promise<void>((done) => {
          releaseAudio = done;
        });
        return outputPath;
      });
    });

    const transcribeAudio = vi.fn(async () => ({ segments: [] }));
    const { db, repos, context } = createTestContext({
      analyzeImage: vi.fn(async () => ({ tags: [] })),
      transcribeAudio
    });

    try {
      mediaMock.probeMedia.mockResolvedValue({ durationSeconds: 12, width: 1280, height: 720 });
      mediaMock.extractVideoFrames.mockResolvedValue([
        { timestampSeconds: 0, thumbnailPath: '/tmp/factory-tour-0.jpg' }
      ]);

      const asset = createAsset(repos, {
        fileName: 'factory-tour.mp4',
        kind: 'video',
        path: '/tmp/factory/factory-tour.mp4',
        extension: '.mp4'
      });
      repos.jobs.ensureJobs(asset.id, ['metadata', 'thumbnail', 'frames', 'audio', 'ai_vision', 'ai_transcript']);

      const drainPromise = drainQueue(context, { limit: 10, maxConcurrent: 3 });
      await audioStarted;
      expect(transcribeAudio).not.toHaveBeenCalled();
      releaseAudio?.();
      await expect(drainPromise).resolves.toBe(6);
      expect(transcribeAudio).toHaveBeenCalledTimes(1);
    } finally {
      closeDb(db);
    }
  });

  it('uses asset precision frame mode when extracting frames', async () => {
    mediaMock.probeMedia.mockResolvedValue({ durationSeconds: 9, width: 1920, height: 1080 });
    mediaMock.extractVideoFrames.mockResolvedValue([
      { timestampSeconds: 0, thumbnailPath: '/tmp/frame-0.jpg' },
      { timestampSeconds: 3, thumbnailPath: '/tmp/frame-3.jpg' }
    ]);

    const { db, repos, context } = createTestContext();
    try {
      const asset = createAsset(repos, {
        fileName: 'factory-tour.mp4',
        kind: 'video',
        path: '/tmp/factory/factory-tour.mp4',
        extension: '.mp4'
      });
      repos.assets.setMetadata(asset.id, { durationSeconds: 9, width: 1920, height: 1080, status: 'partial' });
      repos.jobs.ensureJobs(asset.id, ['metadata', 'thumbnail', 'frames', 'audio', 'ai_vision', 'ai_transcript']);
      for (const job of repos.jobs.listForAsset(asset.id)) {
        if (job.stage !== 'frames' && job.stage !== 'ai_vision') {
          repos.jobs.updateStatus(job.id, 'done');
        }
      }
      repos.assets.precisionAnalyzeAsset(asset.id);

      await expect(processNextJob(context)).resolves.toBe(true);

      expect(mediaMock.extractVideoFrames).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'precision', durationSeconds: 9 })
      );
      expect(repos.frames.listForAsset(asset.id).every((frame) => frame.strategy === 'precision')).toBe(true);
    } finally {
      closeDb(db);
    }
  });
});
