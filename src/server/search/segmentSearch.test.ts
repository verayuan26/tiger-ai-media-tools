import { describe, expect, it } from 'vitest';
import type { createRepositories } from '../db/repositories';
import type { Asset, TranscriptSegment, VideoFrame } from '../../shared/types';
import { searchSegments } from './segmentSearch';

type Repositories = ReturnType<typeof createRepositories>;

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset_1',
    sourceId: 'source_1',
    path: '/materials/truck.mp4',
    fileName: 'truck.mp4',
    kind: 'video',
    extension: '.mp4',
    sizeBytes: 1000,
    hash: 'hash',
    modifiedAt: '2026-06-29T00:00:00.000Z',
    durationSeconds: 60,
    width: 1080,
    height: 1920,
    status: 'done',
    thumbnailPath: '/frames/asset_1-0.jpg',
    frameMode: 'precision',
    createdAt: '2026-06-29T00:00:00.000Z',
    updatedAt: '2026-06-29T00:00:00.000Z',
    ...overrides
  };
}

function makeRepos(input: {
  assets?: Asset[];
  frames?: VideoFrame[];
  assetTags?: Array<{ displayName: string; confidence: number | null; source: 'ai' }>;
  frameTags?: Map<string, Array<{ displayName: string }>>;
  transcripts?: TranscriptSegment[];
}): Repositories {
  return {
    sources: {
      list: () => [{ id: 'source_1' }]
    },
    assets: {
      listBySource: () => input.assets ?? [makeAsset()]
    },
    frames: {
      listForAsset: () =>
        input.frames ?? [
          {
            id: 'frame_1',
            assetId: 'asset_1',
            timestampSeconds: 30,
            thumbnailPath: '/frames/asset_1-30.jpg',
            strategy: 'precision'
          }
        ]
    },
    tags: {
      listForAsset: () =>
        input.assetTags ?? [{ displayName: '电动工具', confidence: 0.9, source: 'ai' as const }],
      listForFrames: () =>
        input.frameTags ?? new Map([['frame_1', [{ displayName: '卡车封车' }, { displayName: '整车' }]]])
    },
    transcripts: {
      listForAsset: () => input.transcripts ?? []
    }
  } as unknown as Repositories;
}

describe('searchSegments', () => {
  it('returns a time-bounded candidate around a matching frame', () => {
    const result = searchSegments(makeRepos({}), {
      shots: [
        {
          shotId: 'C007-S04',
          queries: ['卡车封车', '车辆出发'],
          mustShow: ['封车', '整车'],
          avoid: ['小包裹'],
          minimumDurationSeconds: 6,
          orientation: 'vertical'
        }
      ],
      limitPerShot: 3,
      minimumScore: 0.6
    });

    expect(result.summary).toEqual({
      shotCount: 1,
      matchedShotCount: 1,
      unmatchedShotCount: 0,
      coverage: 1
    });
    const candidate = result.matches[0]?.candidates[0];
    expect(candidate).toMatchObject({
      assetId: 'asset_1',
      frameId: 'frame_1',
      sourceInSeconds: 27,
      sourceOutSeconds: 33,
      previewTimestampSeconds: 30,
      matchedBy: expect.arrayContaining(['frame-tag'])
    });
    expect(candidate?.score).toBeGreaterThanOrEqual(0.6);
  });

  it('rejects an asset when an avoid term matches its tags', () => {
    const result = searchSegments(
      makeRepos({
        assetTags: [
          { displayName: '电动工具', confidence: 0.9, source: 'ai' },
          { displayName: '破损包装', confidence: 0.95, source: 'ai' }
        ]
      }),
      {
        shots: [
          {
            shotId: 'C007-S02',
            queries: ['电动工具原包装'],
            avoid: ['破损包装'],
            minimumDurationSeconds: 5,
            orientation: 'vertical'
          }
        ],
        limitPerShot: 3,
        minimumScore: 0.6
      }
    );

    expect(result.matches[0]).toMatchObject({
      shotId: 'C007-S02',
      status: 'unmatched',
      candidates: []
    });
  });

  it('does not fabricate a candidate when nothing matches', () => {
    const result = searchSegments(
      makeRepos({
        assetTags: [],
        frameTags: new Map([['frame_1', [{ displayName: '办公室空镜' }]]]),
        transcripts: []
      }),
      {
        shots: [
          {
            shotId: 'C007-S05',
            queries: ['核对文件', '检查件数'],
            minimumDurationSeconds: 8,
            orientation: 'vertical'
          }
        ],
        limitPerShot: 3,
        minimumScore: 0.6
      }
    );

    expect(result.summary.coverage).toBe(0);
    expect(result.matches[0]?.status).toBe('unmatched');
    expect(result.matches[0]?.candidates).toHaveLength(0);
  });
});
