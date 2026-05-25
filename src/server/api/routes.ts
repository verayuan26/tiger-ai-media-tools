import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { createRepositories } from '../db/repositories';
import type { AiProvider } from '../ai/provider';
import { importSourceDirectory } from '../scanner/scanner';
import { drainQueue } from '../jobs/jobRunner';

type Repositories = ReturnType<typeof createRepositories>;

export interface ApiRouteContext {
  repos: Repositories;
  aiProvider: AiProvider;
  dataDir: string;
}

const importSourceSchema = z.object({
  rootPath: z.string().trim().min(1),
  name: z.string().trim().min(1)
});

const drainJobsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(25)
});

const retryFailedSchema = z.object({
  assetId: z.string().trim().min(1).optional()
});

export function createApiRouter(context: ApiRouteContext): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  router.get('/sources', (_req, res) => {
    res.json({ sources: context.repos.sources.list() });
  });

  router.post(
    '/sources/import',
    asyncHandler(async (req, res) => {
      const input = importSourceSchema.parse(req.body);
      await assertReadableDirectory(input.rootPath);
      const result = await importSourceDirectory(context.repos, input);
      res.json(result);
    })
  );

  router.post(
    '/dev/import-fixtures',
    asyncHandler(async (_req, res) => {
      const input = {
        rootPath: path.resolve('.data', 'fixtures', 'factory'),
        name: '牛仔面料工厂'
      };
      await assertReadableDirectory(input.rootPath);
      const result = await importSourceDirectory(context.repos, input);
      res.json(result);
    })
  );

  router.get('/assets', (req, res) => {
    res.json({
      assets: context.repos.assets.searchAssets({
        tagNames: normalizeQueryList(req.query.tag),
        query: normalizeOptionalString(req.query.q),
        transcript: normalizeOptionalString(req.query.transcript)
      })
    });
  });

  router.get('/assets/:id', (req, res, next) => {
    const asset = context.repos.assets.getById(req.params.id);
    if (!asset) {
      next(new HttpError(404, 'Asset not found'));
      return;
    }

    res.json({
      asset,
      tags: context.repos.tags.listForAsset(asset.id),
      frames: context.repos.frames.listForAsset(asset.id),
      transcripts: context.repos.transcripts.listForAsset(asset.id),
      jobs: context.repos.jobs.listForAsset(asset.id)
    });
  });

  router.get('/queue', (_req, res) => {
    res.json({ summary: context.repos.jobs.summary() });
  });

  router.post(
    '/jobs/drain',
    asyncHandler(async (req, res) => {
      const { limit } = drainJobsSchema.parse(req.body ?? {});
      const processed = await drainQueue({ ...context, frameMode: 'balanced' }, limit);
      res.json({ processed, summary: context.repos.jobs.summary() });
    })
  );

  router.post('/jobs/retry-failed', (req, res) => {
    const { assetId } = retryFailedSchema.parse(req.body ?? {});
    const changed = context.repos.jobs.retryFailed(assetId);
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
