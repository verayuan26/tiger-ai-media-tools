import { Router } from 'express';
import { z } from 'zod';
import type { createRepositories } from '../db/repositories';
import { searchSegments } from '../search/segmentSearch';

type Repositories = ReturnType<typeof createRepositories>;

const orientationSchema = z.enum(['vertical', 'horizontal', 'square', 'any']);

const segmentSearchSchema = z.object({
  shots: z
    .array(
      z.object({
        shotId: z.string().trim().min(1),
        queries: z.array(z.string().trim().min(1)).min(1).max(20),
        mustShow: z.array(z.string().trim().min(1)).max(20).optional().default([]),
        avoid: z.array(z.string().trim().min(1)).max(20).optional().default([]),
        minimumDurationSeconds: z.number().positive().max(300),
        orientation: orientationSchema.optional().default('any')
      })
    )
    .min(1)
    .max(100),
  limitPerShot: z.number().int().min(1).max(10).optional().default(3),
  excludeAssetIds: z.array(z.string().trim().min(1)).max(500).optional().default([]),
  options: z
    .object({
      minimumScore: z.number().min(0).max(1).optional().default(0.6)
    })
    .optional()
    .default({ minimumScore: 0.6 })
});

export function createSegmentSearchRouter(context: { repos: Repositories }): Router {
  const router = Router();

  router.post('/search/segments', (req, res) => {
    const input = segmentSearchSchema.parse(req.body ?? {});
    const result = searchSegments(context.repos, {
      shots: input.shots,
      limitPerShot: input.limitPerShot,
      excludeAssetIds: input.excludeAssetIds,
      minimumScore: input.options.minimumScore
    });

    res.json(result);
  });

  return router;
}
