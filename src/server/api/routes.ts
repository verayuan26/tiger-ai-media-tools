import { constants, createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { lookup } from 'mime-types';
import { resolveAssetMediaPath, resolveAssetPreviewPath } from '../media/preview';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { createRepositories } from '../db/repositories';
import type { AiProvider } from '../ai/provider';
import {
  DirectoryPickerCancelledError,
  DirectoryPickerUnavailableError,
  pickDirectory,
  pickFile
} from '../media/pickDirectory';
import { revealInFileManager } from '../media/revealInFileManager';
import { clearGeneratedCache, getGeneratedCacheStats } from '../media/cacheStorage';
import { importSourceDirectory } from '../scanner/scanner';
import { drainQueue } from '../jobs/jobRunner';
import type { createSettingsService } from '../settings/settingsService';

type Repositories = ReturnType<typeof createRepositories>;
type SettingsService = ReturnType<typeof createSettingsService>;

export interface ApiRouteContext {
  repos: Repositories;
  aiProvider: AiProvider;
  dataDir: string;
  enableDevRoutes: boolean;
  settingsService: SettingsService;
}

const importSourceSchema = z.object({
  rootPath: z.string().trim().min(1),
  name: z.string().trim().min(1),
  incrementalScanEnabled: z.boolean().optional().default(true)
});

const updateSourceSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    rootPath: z.string().trim().min(1).optional(),
    incrementalScanEnabled: z.boolean().optional()
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one field is required'
  });

const drainJobsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(25)
});

const retryFailedSchema = z
  .object({
    assetId: z.string().trim().min(1).optional(),
    assetIds: z.array(z.string().trim().min(1)).min(1).max(100).optional()
  })
  .refine((input) => !(input.assetId && input.assetIds?.length), {
    message: 'Use either assetId or assetIds, not both'
  });

const createTagSchema = z.object({
  displayName: z.string().trim().min(1),
  normalizedName: z.string().trim().min(1).optional()
});

const listJobsSchema = z.object({
  limit: z.number().int().min(1).max(200).optional().default(50)
});

const aiProviderNameSchema = z.enum(['mock', 'openai-compatible']);
const apiProtocolSchema = z.enum(['openai', 'anthropic', 'azure', 'custom']);
const transcriptionModeSchema = z.enum(['cloud', 'fallback', 'auto']);
const fallbackTranscribeProviderSchema = z.enum(['openai-compatible', 'dashscope-asr']);

const patchSettingsSchema = z
  .object({
    apiProtocol: apiProtocolSchema.optional(),
    apiEndpoint: z.string().trim().min(1).optional(),
    apiKey: z.string().optional(),
    aiProviderName: aiProviderNameSchema.optional(),
    openAiVisionModel: z.string().trim().optional(),
    openAiTranscribeModel: z.string().trim().optional(),
    transcriptionMode: transcriptionModeSchema.optional(),
    fallbackTranscribeProvider: fallbackTranscribeProviderSchema.optional(),
    fallbackTranscribeEndpoint: z.string().trim().optional(),
    fallbackTranscribeModel: z.string().trim().optional(),
    fallbackTranscribeApiKey: z.string().optional(),
    dailyBudgetYuan: z.number().int().min(10).max(500).optional(),
    concurrentTasks: z.number().int().min(1).max(10).optional(),
    precisionModeDefault: z.boolean().optional(),
    reuseParsedResults: z.boolean().optional()
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: 'At least one field is required'
  });

const testAiSchema = z.object({
  apiProtocol: apiProtocolSchema.optional(),
  apiEndpoint: z.string().trim().min(1).optional(),
  apiKey: z.string().optional(),
  aiProviderName: aiProviderNameSchema.optional(),
  openAiVisionModel: z.string().trim().min(1).optional(),
  openAiTranscribeModel: z.string().trim().min(1).optional()
});

export function createApiRouter(context: ApiRouteContext): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  router.post(
    '/system/pick-directory',
    asyncHandler(async (_req, res, next) => {
      try {
        const path = await pickDirectory();
        res.json({ path });
      } catch (error) {
        if (error instanceof DirectoryPickerCancelledError) {
          res.json({ cancelled: true });
          return;
        }
        if (error instanceof DirectoryPickerUnavailableError) {
          next(new HttpError(503, error.message));
          return;
        }
        next(error);
      }
    })
  );

  router.post(
    '/system/pick-file',
    asyncHandler(async (req, res, next) => {
      const { filter } = (req.body ?? {}) as { filter?: string };
      try {
        const picked = await pickFile(filter);
        res.json({ path: picked });
      } catch (error) {
        if (error instanceof DirectoryPickerCancelledError) {
          res.json({ cancelled: true });
          return;
        }
        if (error instanceof DirectoryPickerUnavailableError) {
          next(new HttpError(503, error.message));
          return;
        }
        next(error);
      }
    })
  );

  router.get(
    '/system/cache',
    asyncHandler(async (_req, res) => {
      const cache = await getGeneratedCacheStats(context.dataDir);
      res.json({ cache });
    })
  );

  router.post(
    '/system/cache/clear',
    asyncHandler(async (_req, res) => {
      const cache = await clearGeneratedCache(context.dataDir);
      res.json({ cache });
    })
  );

  router.get('/settings', (_req, res) => {
    res.json({ settings: context.settingsService.getSettings() });
  });

  router.patch('/settings', (req, res) => {
    const input = patchSettingsSchema.parse(req.body);
    const settings = context.settingsService.patchSettings(input);
    res.json({ settings });
  });

  router.post(
    '/settings/test-ai',
    asyncHandler(async (req, res) => {
      const input = testAiSchema.parse(req.body ?? {});
      const result = await context.settingsService.testAiConnection(input);
      res.status(result.ok ? 200 : 400).json(result);
    })
  );

  router.get('/sources', (_req, res) => {
    res.json({ sources: context.repos.sources.listWithStats() });
  });

  router.get('/tags', (_req, res) => {
    res.json({ tags: context.repos.tags.listWithStats() });
  });

  router.post('/tags', (req, res) => {
    const input = createTagSchema.parse(req.body);
    const tag = context.repos.tags.createUserTag(input.displayName, input.normalizedName);
    res.status(201).json({ tag });
  });

  router.get('/jobs', (req, res) => {
    const limit = listJobsSchema.parse({
      limit: req.query.limit === undefined ? undefined : Number(req.query.limit)
    }).limit;
    res.json({ jobs: context.repos.jobs.listActive(limit) });
  });

  router.post(
    '/sources/import',
    asyncHandler(async (req, res) => {
      const input = importSourceSchema.parse(req.body);
      await assertReadableDirectory(input.rootPath);
      const result = await importSourceDirectory(context.repos, {
        ...input,
        defaultFrameMode: context.settingsService.getFrameMode()
      });
      res.json(result);
    })
  );

  router.patch(
    '/sources/:id',
    asyncHandler(async (req, res, next) => {
      const input = updateSourceSchema.parse(req.body);
      if (input.rootPath) {
        await assertReadableDirectory(input.rootPath);
      }

      const source = context.repos.sources.updateSource(req.params.id, input);
      if (!source) {
        next(new HttpError(404, 'Source not found'));
        return;
      }

      res.json({ source });
    })
  );

  router.delete('/sources/:id', (req, res, next) => {
    const deleted = context.repos.sources.deleteSource(req.params.id);
    if (!deleted) {
      next(new HttpError(404, 'Source not found'));
      return;
    }

    res.json({ ok: true });
  });

  router.post(
    '/sources/:id/rescan',
    asyncHandler(async (req, res, next) => {
      const source = context.repos.sources.getById(req.params.id);
      if (!source) {
        next(new HttpError(404, 'Source not found'));
        return;
      }

      await assertReadableDirectory(source.rootPath);
      const result = await importSourceDirectory(context.repos, {
        rootPath: source.rootPath,
        name: source.name,
        incrementalScanEnabled: source.incrementalScanEnabled,
        defaultFrameMode: context.settingsService.getFrameMode()
      });
      res.json(result);
    })
  );

  if (context.enableDevRoutes) {
    router.post(
      '/dev/import-fixtures',
      asyncHandler(async (_req, res) => {
        const input = {
          rootPath: path.resolve('.data', 'fixtures', 'factory'),
          name: '牛仔面料工厂'
        };
        await assertReadableDirectory(input.rootPath);
        const result = await importSourceDirectory(context.repos, {
          ...input,
          defaultFrameMode: context.settingsService.getFrameMode()
        });
        res.json(result);
      })
    );
  }

  router.get('/assets', (req, res) => {
    const assets = context.repos.assets.searchAssets({
      tagNames: normalizeQueryList(req.query.tag),
      query: normalizeOptionalString(req.query.q),
      transcript: normalizeOptionalString(req.query.transcript)
    });
    const tagSummaries = context.repos.tags.listSummariesForAssets(assets.map((item) => item.id));

    res.json({
      assets: assets.map((asset) => {
        const summary = tagSummaries.get(asset.id) ?? { tags: [], tagCount: 0 };
        return { ...asset, tags: summary.tags, tagCount: summary.tagCount };
      })
    });
  });

  router.get('/assets/:id', (req, res, next) => {
    const asset = context.repos.assets.getById(req.params.id);
    if (!asset) {
      next(new HttpError(404, 'Asset not found'));
      return;
    }

    const frames = context.repos.frames.listForAsset(asset.id);
    const frameTags = context.repos.tags.listForFrames(frames.map((frame) => frame.id));

    res.json({
      asset,
      tags: context.repos.tags.listForAsset(asset.id),
      frames: frames.map((frame) => ({
        ...frame,
        tags: frameTags.get(frame.id) ?? []
      })),
      transcripts: context.repos.transcripts.listForAsset(asset.id),
      jobs: context.repos.jobs.listForAsset(asset.id)
    });
  });

  router.post(
    '/assets/:id/reveal',
    asyncHandler(async (req, res, next) => {
      const asset = context.repos.assets.getById(req.params.id);
      if (!asset) {
        next(new HttpError(404, 'Asset not found'));
        return;
      }

      try {
        await revealInFileManager(asset.path);
      } catch {
        next(new HttpError(404, 'Asset file not found on disk'));
        return;
      }

      res.json({ ok: true });
    })
  );

  router.post(
    '/assets/:id/reanalyze',
    asyncHandler(async (req, res, next) => {
      const asset = context.repos.assets.reanalyzeAsset(req.params.id);
      if (!asset) {
        next(new HttpError(404, 'Asset not found'));
        return;
      }

      res.json({ ok: true, asset, jobs: context.repos.jobs.listForAsset(asset.id) });
    })
  );

  router.post(
    '/assets/:id/precision-analyze',
    asyncHandler(async (req, res, next) => {
      const existing = context.repos.assets.getById(req.params.id);
      if (!existing) {
        next(new HttpError(404, 'Asset not found'));
        return;
      }

      if (existing.kind !== 'video') {
        next(new HttpError(422, 'Precision analyze is only available for video assets'));
        return;
      }

      const asset = context.repos.assets.precisionAnalyzeAsset(existing.id);
      if (!asset) {
        next(new HttpError(404, 'Asset not found'));
        return;
      }

      res.json({ ok: true, asset, jobs: context.repos.jobs.listForAsset(asset.id) });
    })
  );

  router.get(
    '/assets/:id/preview',
    asyncHandler(async (req, res, next) => {
      const asset = context.repos.assets.getById(req.params.id);
      if (!asset) {
        next(new HttpError(404, 'Asset not found'));
        return;
      }

      const source = context.repos.sources.getById(asset.sourceId);
      const frames = context.repos.frames.listForAsset(asset.id);
      const previewPath = resolveAssetPreviewPath({
        asset,
        sourceRootPath: source?.rootPath ?? null,
        dataDir: context.dataDir,
        frameThumbnailPaths: frames.map((frame) => frame.thumbnailPath)
      });

      if (!previewPath) {
        next(new HttpError(404, 'Preview not available'));
        return;
      }

      try {
        await access(previewPath, constants.R_OK);
      } catch {
        next(new HttpError(404, 'Preview not available'));
        return;
      }

      res.sendFile(previewPath);
    })
  );

  router.get(
    '/assets/:id/media',
    asyncHandler(async (req, res, next) => {
      const asset = context.repos.assets.getById(req.params.id);
      if (!asset) {
        next(new HttpError(404, 'Asset not found'));
        return;
      }

      const source = context.repos.sources.getById(asset.sourceId);
      const mediaPath = resolveAssetMediaPath({
        asset,
        sourceRootPath: source?.rootPath ?? null
      });

      if (!mediaPath) {
        next(new HttpError(404, 'Media not available'));
        return;
      }

      try {
        await access(mediaPath, constants.R_OK);
      } catch {
        next(new HttpError(404, 'Media not available'));
        return;
      }

      const contentType = lookup(mediaPath) || 'application/octet-stream';

      const fileStat = await stat(mediaPath);
      const fileSize = fileStat.size;
      const rangeHeader = req.headers.range;

      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', contentType);

      if (rangeHeader) {
        const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
        const start = match?.[1] ? parseInt(match[1], 10) : 0;
        const end = match?.[2] ? parseInt(match[2], 10) : fileSize - 1;
        const clampedEnd = Math.min(end, fileSize - 1);
        const chunkSize = clampedEnd - start + 1;

        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${clampedEnd}/${fileSize}`);
        res.setHeader('Content-Length', chunkSize);

        const stream = createReadStream(mediaPath, { start, end: clampedEnd });
        stream.on('error', (err) => {
          if (!res.headersSent) next(err);
        });
        stream.pipe(res);
      } else {
        res.setHeader('Content-Length', fileSize);
        const stream = createReadStream(mediaPath);
        stream.on('error', (err) => {
          if (!res.headersSent) next(err);
        });
        stream.pipe(res);
      }
    })
  );

  router.get('/queue', (_req, res) => {
    res.json({ summary: context.repos.jobs.summary() });
  });

  router.post(
    '/jobs/drain',
    asyncHandler(async (req, res) => {
      const { limit } = drainJobsSchema.parse(req.body ?? {});
      const aiProvider = context.settingsService.resolveAiProvider();
      const settings = context.settingsService.getSettings();
      const drainResult = await drainQueue(
        {
          repos: context.repos,
          aiProvider,
          dataDir: context.dataDir,
          frameMode: context.settingsService.getFrameMode(),
          ffmpegPath: settings.ffmpegPath || null,
          checkDrainLimits: (processingCount) => context.settingsService.checkDrainLimits(processingCount),
          checkJobBudget: (job) => context.settingsService.checkJobBudget(job),
          onAiJobCompleted: (job) => context.settingsService.recordAiJobSpend(job)
        },
        { limit, maxConcurrent: settings.concurrentTasks }
      );

      const payload =
        typeof drainResult === 'number'
          ? { processed: drainResult, blocked: null as null }
          : drainResult;

      if (payload.blocked) {
        res.status(429).json({
          processed: payload.processed,
          blocked: payload.blocked,
          summary: context.repos.jobs.summary()
        });
        return;
      }

      res.json({ processed: payload.processed, blocked: null, summary: context.repos.jobs.summary() });
    })
  );

  router.post('/jobs/retry-failed', (req, res) => {
    const { assetId, assetIds } = retryFailedSchema.parse(req.body ?? {});
    const changed = context.repos.jobs.retryFailed(assetIds ?? assetId);
    res.json({ changed, summary: context.repos.jobs.summary() });
  });

  return router;
}

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

async function assertReadableDirectory(rootPath: string): Promise<void> {
  const resolvedRootPath = path.resolve(rootPath);

  try {
    const rootStat = await stat(resolvedRootPath);
    if (!rootStat.isDirectory()) {
      throw new HttpError(400, 'Import root must be an existing readable directory');
    }

    await access(resolvedRootPath, constants.R_OK);
  } catch (error) {
    if (error instanceof HttpError) throw error;

    throw new HttpError(400, 'Import root must be an existing readable directory');
  }
}

function normalizeQueryList(value: unknown): string[] | undefined {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const normalized = values
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
