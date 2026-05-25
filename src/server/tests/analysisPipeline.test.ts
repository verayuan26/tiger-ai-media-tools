import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractVideoFrames, parseFfprobeDuration, probeMedia, safeFrameFileStem } from '../media/ffmpeg';
import { planFrameTimestamps } from '../media/framePlan';

const execaMock = vi.hoisted(() => vi.fn());

vi.mock('execa', () => ({
  execa: execaMock
}));

beforeEach(() => {
  execaMock.mockReset();
});

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

describe('probeMedia', () => {
  it('invokes ffprobe with the intended args and parses media metadata', async () => {
    execaMock.mockResolvedValueOnce({
      stdout: JSON.stringify({
        format: { duration: '42.5' },
        streams: [{ width: 1920, height: 1080 }]
      })
    });

    await expect(probeMedia('/input/video.mp4')).resolves.toEqual({
      durationSeconds: 42.5,
      width: 1920,
      height: 1080
    });
    expect(execaMock).toHaveBeenCalledTimes(1);
    expect(execaMock).toHaveBeenCalledWith('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration:stream=width,height',
      '-of',
      'json',
      '/input/video.mp4'
    ]);
  });

  it('returns null duration for invalid ffprobe duration metadata', async () => {
    execaMock.mockResolvedValueOnce({
      stdout: JSON.stringify({
        format: { duration: 'N/A' },
        streams: [{ width: 640, height: 360 }]
      })
    });

    await expect(probeMedia('/input/odd-video.mp4')).resolves.toEqual({
      durationSeconds: null,
      width: 640,
      height: 360
    });
  });
});

describe('extractVideoFrames', () => {
  it('invokes ffmpeg once per planned timestamp and returns sanitized output frame records', async () => {
    execaMock.mockResolvedValue({ stdout: '' });
    const outputDir = await mkdtemp(path.join(os.tmpdir(), 'ai-media-frames-'));

    try {
      const frames = await extractVideoFrames({
        filePath: '/input/video.mp4',
        assetId: '../foo/bar',
        durationSeconds: 16,
        outputDir,
        mode: 'balanced'
      });

      const expectedFrames = [0, 8, 16].map((timestamp) => ({
        timestampSeconds: timestamp,
        thumbnailPath: path.join(outputDir, `foo-bar-${timestamp}.jpg`)
      }));

      expect(frames).toEqual(expectedFrames);
      expect(execaMock).toHaveBeenCalledTimes(3);
      for (const frame of frames) {
        expect(frame.thumbnailPath.startsWith(`${outputDir}${path.sep}`)).toBe(true);
        expect(path.relative(outputDir, frame.thumbnailPath).startsWith('..')).toBe(false);
        expect(path.dirname(frame.thumbnailPath)).toBe(outputDir);
      }
      expect(execaMock).toHaveBeenNthCalledWith(1, 'ffmpeg', [
        '-y',
        '-ss',
        '0',
        '-i',
        '/input/video.mp4',
        '-frames:v',
        '1',
        '-vf',
        'scale=480:-1',
        path.join(outputDir, 'foo-bar-0.jpg')
      ]);
      expect(execaMock).toHaveBeenNthCalledWith(2, 'ffmpeg', [
        '-y',
        '-ss',
        '8',
        '-i',
        '/input/video.mp4',
        '-frames:v',
        '1',
        '-vf',
        'scale=480:-1',
        path.join(outputDir, 'foo-bar-8.jpg')
      ]);
      expect(execaMock).toHaveBeenNthCalledWith(3, 'ffmpeg', [
        '-y',
        '-ss',
        '16',
        '-i',
        '/input/video.mp4',
        '-frames:v',
        '1',
        '-vf',
        'scale=480:-1',
        path.join(outputDir, 'foo-bar-16.jpg')
      ]);
    } finally {
      await rm(outputDir, { force: true, recursive: true });
    }
  });
});
