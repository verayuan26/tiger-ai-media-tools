import { describe, expect, it } from 'vitest';
import { parseFfprobeDuration, safeFrameFileStem } from '../media/ffmpeg';
import { planFrameTimestamps } from '../media/framePlan';

describe('planFrameTimestamps', () => {
  it('uses interval fallback for normal mode', () => {
    expect(planFrameTimestamps({ durationSeconds: 30, mode: 'balanced', fallbackIntervalSeconds: 10 })).toEqual([
      0,
      10,
      20,
      30
    ]);
  });

  it('uses three second precision mode for detailed inspection', () => {
    expect(planFrameTimestamps({ durationSeconds: 9, mode: 'precision', fallbackIntervalSeconds: 10 })).toEqual([
      0,
      3,
      6,
      9
    ]);
  });

  it('returns no timestamps for negative durations', () => {
    expect(planFrameTimestamps({ durationSeconds: -1, mode: 'balanced', fallbackIntervalSeconds: 10 })).toEqual([]);
  });

  it('returns no timestamps for non-finite durations', () => {
    expect(planFrameTimestamps({ durationSeconds: Number.NaN, mode: 'balanced', fallbackIntervalSeconds: 10 })).toEqual(
      []
    );
    expect(planFrameTimestamps({ durationSeconds: Number.POSITIVE_INFINITY, mode: 'balanced', fallbackIntervalSeconds: 10 })).toEqual(
      []
    );
  });

  it('floors sub-second durations', () => {
    expect(planFrameTimestamps({ durationSeconds: 0.8, mode: 'balanced', fallbackIntervalSeconds: 10 })).toEqual([0]);
    expect(planFrameTimestamps({ durationSeconds: 10.8, mode: 'balanced', fallbackIntervalSeconds: 10 })).toEqual([
      0,
      10
    ]);
  });

  it('treats fallback intervals below one second as one second', () => {
    expect(planFrameTimestamps({ durationSeconds: 2, mode: 'balanced', fallbackIntervalSeconds: 0 })).toEqual([
      0,
      1,
      2
    ]);
  });

  it('includes the final second for non-divisible durations', () => {
    expect(planFrameTimestamps({ durationSeconds: 25, mode: 'balanced', fallbackIntervalSeconds: 10 })).toEqual([
      0,
      10,
      20,
      25
    ]);
  });
});

describe('parseFfprobeDuration', () => {
  it('parses finite duration values', () => {
    expect(parseFfprobeDuration('12.25')).toBe(12.25);
  });

  it('returns null for non-numeric ffprobe durations', () => {
    expect(parseFfprobeDuration('N/A')).toBeNull();
  });
});

describe('safeFrameFileStem', () => {
  it('removes path traversal and nested path separators from asset ids', () => {
    expect(safeFrameFileStem('../x')).toBe('x');
    expect(safeFrameFileStem('foo/bar')).toBe('foo-bar');
  });

  it('falls back when an asset id has no safe filename characters', () => {
    expect(safeFrameFileStem('../')).toBe('asset');
  });
});
