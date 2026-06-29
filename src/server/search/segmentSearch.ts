import type { createRepositories } from '../db/repositories';

type Repositories = ReturnType<typeof createRepositories>;

export interface SegmentSearchShotInput {
  shotId: string;
  queries: string[];
  mustShow?: string[];
  avoid?: string[];
  minimumDurationSeconds: number;
  orientation?: 'vertical' | 'horizontal' | 'square' | 'any';
}

export interface SegmentSearchInput {
  shots: SegmentSearchShotInput[];
  limitPerShot: number;
  excludeAssetIds?: string[];
  minimumScore?: number;
}

export interface SegmentCandidate {
  rank: number;
  assetId: string;
  assetPath: string;
  frameId: string | null;
  sourceInSeconds: number;
  sourceOutSeconds: number;
  previewTimestampSeconds: number;
  score: number;
  scoreBreakdown: {
    frameTags: number;
    assetTags: number;
    transcript: number;
    mustShow: number;
    formatFit: number;
    durationFit: number;
  };
  matchedBy: Array<'frame-tag' | 'asset-tag' | 'transcript'>;
  matchedTerms: string[];
  warnings: string[];
}

export interface SegmentSearchResult {
  summary: {
    shotCount: number;
    matchedShotCount: number;
    unmatchedShotCount: number;
    coverage: number;
  };
  matches: Array<{
    shotId: string;
    status: 'matched' | 'unmatched';
    candidates: SegmentCandidate[];
    reason?: string;
  }>;
}

export function searchSegments(repos: Repositories, input: SegmentSearchInput): SegmentSearchResult {
  const excluded = new Set(input.excludeAssetIds ?? []);
  const assets = repos.sources
    .list()
    .flatMap((source) => repos.assets.listBySource(source.id))
    .filter(
      (asset) =>
        asset.kind === 'video' &&
        !excluded.has(asset.id) &&
        asset.durationSeconds &&
        asset.durationSeconds > 0
    );

  const matches = input.shots.map((shot) => {
    const queryTerms = buildTerms(shot.queries);
    const mustShowTerms = buildTerms(shot.mustShow ?? []);
    const avoidTerms = buildTerms(shot.avoid ?? []);
    const desiredDuration = Math.max(0.5, shot.minimumDurationSeconds);
    const candidates: Omit<SegmentCandidate, 'rank'>[] = [];

    for (const asset of assets) {
      const duration = asset.durationSeconds ?? 0;
      if (duration < desiredDuration) continue;

      const assetTags = repos.tags.listForAsset(asset.id);
      const frames = repos.frames.listForAsset(asset.id);
      const frameTags = repos.tags.listForFrames(frames.map((frame) => frame.id));
      const transcripts = repos.transcripts.listForAsset(asset.id);
      const assetTagNames = assetTags.map((tag) => tag.displayName);
      const transcriptTexts = transcripts.flatMap((segment) => [segment.text, segment.translation ?? '']);
      const assetAvoidMatches = matchTerms(assetTagNames, avoidTerms);

      if (assetAvoidMatches.length > 0) continue;

      const anchors =
        frames.length > 0
          ? frames.map((frame) => ({
              frameId: frame.id,
              timestampSeconds: frame.timestampSeconds,
              frameTagNames: (frameTags.get(frame.id) ?? []).map((tag) => tag.displayName)
            }))
          : [
              {
                frameId: null,
                timestampSeconds: bestTranscriptAnchor(transcripts, queryTerms, duration),
                frameTagNames: [] as string[]
              }
            ];

      let bestForAsset: Omit<SegmentCandidate, 'rank'> | null = null;

      for (const anchor of anchors) {
        const frameAvoidMatches = matchTerms(anchor.frameTagNames, avoidTerms);
        if (frameAvoidMatches.length > 0) continue;

        const frameMatches = matchTerms(anchor.frameTagNames, queryTerms);
        const assetMatches = matchTerms(assetTagNames, queryTerms);
        const transcriptMatches = matchTerms(transcriptTexts, queryTerms);
        const allVisibleTerms = [...anchor.frameTagNames, ...assetTagNames];
        const mustShowMatches = matchTerms(allVisibleTerms, mustShowTerms);

        if (frameMatches.length === 0 && assetMatches.length === 0 && transcriptMatches.length === 0) {
          continue;
        }

        const scoreBreakdown = {
          frameTags: frameMatches.length > 0 ? Math.min(0.6, 0.5 + (frameMatches.length - 1) * 0.03) : 0,
          assetTags:
            assetMatches.length > 0
              ? Math.min(
                  0.2,
                  0.15 *
                    Math.max(
                      0.5,
                      ...assetTags
                        .filter((tag) => termMatchesAny(tag.displayName, assetMatches))
                        .map((tag) => tag.confidence ?? 0.75)
                    )
                )
              : 0,
          transcript: transcriptMatches.length > 0 ? 0.15 : 0,
          mustShow:
            mustShowTerms.length > 0
              ? 0.1 * Math.min(1, mustShowMatches.length / mustShowTerms.length)
              : 0,
          formatFit: orientationMatches(asset.width, asset.height, shot.orientation) ? 0.1 : 0,
          durationFit: 0.05
        };
        const score = roundScore(
          Math.min(1, Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0))
        );
        const { sourceInSeconds, sourceOutSeconds } = clipRange(
          anchor.timestampSeconds,
          desiredDuration,
          duration
        );
        const warnings: string[] = [];

        const missingMustShow = mustShowTerms.filter(
          (term) => !mustShowMatches.some((matched) => termMatches(term, matched))
        );
        if (missingMustShow.length > 0) {
          warnings.push(`未从标签中确认必备画面：${missingMustShow.join('、')}`);
        }
        if (!orientationMatches(asset.width, asset.height, shot.orientation)) {
          warnings.push('素材画幅与目标画幅不一致，需要安全裁切');
        }
        if (matchTerms(transcriptTexts, avoidTerms).length > 0) {
          warnings.push('素材字幕中出现规避词，请人工确认对应时间段');
        }

        const matchedBy: SegmentCandidate['matchedBy'] = [];
        if (frameMatches.length > 0) matchedBy.push('frame-tag');
        if (assetMatches.length > 0) matchedBy.push('asset-tag');
        if (transcriptMatches.length > 0) matchedBy.push('transcript');

        const candidate: Omit<SegmentCandidate, 'rank'> = {
          assetId: asset.id,
          assetPath: asset.path,
          frameId: anchor.frameId,
          sourceInSeconds,
          sourceOutSeconds,
          previewTimestampSeconds: anchor.timestampSeconds,
          score,
          scoreBreakdown,
          matchedBy,
          matchedTerms: Array.from(new Set([...frameMatches, ...assetMatches, ...transcriptMatches])),
          warnings
        };

        if (!bestForAsset || candidate.score > bestForAsset.score) {
          bestForAsset = candidate;
        }
      }

      if (bestForAsset) candidates.push(bestForAsset);
    }

    const ranked = candidates
      .filter((candidate) => candidate.score >= input.minimumScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, input.limitPerShot)
      .map((candidate, index) => ({ ...candidate, rank: index + 1 }));

    return ranked.length > 0
      ? { shotId: shot.shotId, status: 'matched' as const, candidates: ranked }
      : {
          shotId: shot.shotId,
          status: 'unmatched' as const,
          candidates: [],
          reason: `没有候选片段达到最低分数 ${input.minimumScore.toFixed(2)}`
        };
  });

  const matchedShotCount = matches.filter((match) => match.status === 'matched').length;
  const shotCount = matches.length;

  return {
    summary: {
      shotCount,
      matchedShotCount,
      unmatchedShotCount: shotCount - matchedShotCount,
      coverage: shotCount === 0 ? 0 : roundScore(matchedShotCount / shotCount)
    },
    matches
  };
}

function buildTerms(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .flatMap((value) => [value, ...value.split(/[\s,，、/|]+/u)])
        .map(normalizeText)
        .filter((value) => value.length >= 2)
    )
  );
}

function normalizeText(value: string): string {
  return value.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function matchTerms(haystacks: string[], terms: string[]): string[] {
  const normalizedHaystacks = haystacks.map(normalizeText).filter(Boolean);
  return terms.filter((term) =>
    normalizedHaystacks.some((haystack) => haystack.includes(term) || term.includes(haystack))
  );
}

function termMatchesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => termMatches(normalizeText(value), term));
}

function termMatches(left: string, right: string): boolean {
  return left.includes(right) || right.includes(left);
}

function orientationMatches(
  width: number | null,
  height: number | null,
  orientation: SegmentSearchShotInput['orientation']
): boolean {
  if (!orientation || orientation === 'any' || !width || !height) return true;
  if (orientation === 'vertical') return height > width;
  if (orientation === 'horizontal') return width > height;
  return Math.abs(width - height) / Math.max(width, height) <= 0.1;
}

function bestTranscriptAnchor(
  transcripts: Array<{ startSeconds: number; endSeconds: number; text: string; translation: string | null }>,
  queryTerms: string[],
  duration: number
): number {
  const match = transcripts.find(
    (segment) => matchTerms([segment.text, segment.translation ?? ''], queryTerms).length > 0
  );
  if (!match || match.endSeconds <= match.startSeconds) return duration / 2;
  return (match.startSeconds + match.endSeconds) / 2;
}

function clipRange(anchor: number, desiredDuration: number, assetDuration: number) {
  const safeAnchor = Math.min(assetDuration, Math.max(0, anchor));
  let sourceInSeconds = Math.max(0, safeAnchor - desiredDuration / 2);
  let sourceOutSeconds = sourceInSeconds + desiredDuration;

  if (sourceOutSeconds > assetDuration) {
    sourceOutSeconds = assetDuration;
    sourceInSeconds = Math.max(0, sourceOutSeconds - desiredDuration);
  }

  return {
    sourceInSeconds: roundTime(sourceInSeconds),
    sourceOutSeconds: roundTime(sourceOutSeconds)
  };
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function roundTime(value: number): number {
  return Math.round(value * 100) / 100;
}
