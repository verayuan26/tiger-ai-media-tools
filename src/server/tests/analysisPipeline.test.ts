import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAiProvider } from '../ai/mockProvider';
import {
  createOpenAiCompatibleProvider,
  normalizeOpenAiCompatibleBaseUrl
} from '../ai/openAiCompatibleProvider';
import {
  buildFfmpegFrameArgs,
  buildFrameScaleFilter,
  extractAudioTrack,
  extractVideoFrames,
  parseFfprobeDuration,
  probeMedia,
  resolveTranscriptionAudioPath,
  safeFrameFileStem,
  transcriptionAudioPath
} from '../media/ffmpeg';
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

describe('normalizeOpenAiCompatibleBaseUrl', () => {
  it('appends /v1 when the endpoint omits the version segment', () => {
    expect(normalizeOpenAiCompatibleBaseUrl('https://api.openai.com')).toBe('https://api.openai.com/v1');
    expect(normalizeOpenAiCompatibleBaseUrl('https://api.openai.com/')).toBe('https://api.openai.com/v1');
  });

  it('keeps endpoints that already end with /v1', () => {
    expect(normalizeOpenAiCompatibleBaseUrl('https://example.com/v1')).toBe('https://example.com/v1');
    expect(normalizeOpenAiCompatibleBaseUrl('https://openrouter.ai/api/v1')).toBe('https://openrouter.ai/api/v1');
  });
});

describe('transcription audio paths', () => {
  it('stores extracted audio under the data directory for videos', () => {
    const outputPath = transcriptionAudioPath('/data', '../clip/id');
    expect(outputPath).toBe(path.join('/data', 'audio', 'clip-id.wav'));
    expect(path.relative('/data', outputPath).startsWith('..')).toBe(false);
  });

  it('uses the original asset path for audio files', () => {
    expect(
      resolveTranscriptionAudioPath(
        { id: 'a1', kind: 'audio', path: '/library/talk.wav' },
        '/data'
      )
    ).toBe('/library/talk.wav');
  });

  it('uses the extracted wav path for videos', () => {
    expect(
      resolveTranscriptionAudioPath(
        { id: 'v1', kind: 'video', path: '/library/clip.mp4' },
        '/data'
      )
    ).toBe(path.join('/data', 'audio', 'v1.wav'));
  });
});

describe('extractAudioTrack', () => {
  it('invokes ffmpeg to extract a mono wav track for transcription', async () => {
    execaMock.mockResolvedValue({ stdout: '' });
    const outputDir = await mkdtemp(path.join(os.tmpdir(), 'ai-media-audio-'));

    try {
      const outputPath = path.join(outputDir, 'clip.wav');
      await extractAudioTrack({ filePath: '/input/video.mp4', outputPath });

      expect(execaMock).toHaveBeenCalledWith('ffmpeg', [
        '-y',
        '-i',
        '/input/video.mp4',
        '-vn',
        '-acodec',
        'pcm_s16le',
        '-ar',
        '16000',
        '-ac',
        '1',
        outputPath
      ]);
    } finally {
      await rm(outputDir, { force: true, recursive: true });
    }
  });
});

describe('buildFrameScaleFilter', () => {
  it('preserves source resolution for typical widths up to 1920px', () => {
    expect(buildFrameScaleFilter(null)).toBeNull();
    expect(buildFrameScaleFilter(undefined)).toBeNull();
    expect(buildFrameScaleFilter(0)).toBeNull();
    expect(buildFrameScaleFilter(480)).toBeNull();
    expect(buildFrameScaleFilter(1280)).toBeNull();
    expect(buildFrameScaleFilter(1920)).toBeNull();
  });

  it('downscales very large sources without going below 720px width', () => {
    expect(buildFrameScaleFilter(3840)).toBe('scale=1920:-2');
    expect(buildFrameScaleFilter(2560)).toBe('scale=1920:-2');
  });
});

describe('buildFfmpegFrameArgs', () => {
  it('omits scale filter for normal widths and uses high JPEG quality', () => {
    expect(
      buildFfmpegFrameArgs({
        timestampSeconds: 3,
        filePath: '/input/video.mp4',
        outputPath: '/output/frame-3.jpg',
        sourceWidth: 1280
      })
    ).toEqual(['-y', '-ss', '3', '-i', '/input/video.mp4', '-frames:v', '1', '-q:v', '2', '/output/frame-3.jpg']);
  });

  it('adds scale filter only when source width exceeds the cap', () => {
    expect(
      buildFfmpegFrameArgs({
        timestampSeconds: 0,
        filePath: '/input/video.mp4',
        outputPath: '/output/frame-0.jpg',
        sourceWidth: 3840
      })
    ).toEqual([
      '-y',
      '-ss',
      '0',
      '-i',
      '/input/video.mp4',
      '-frames:v',
      '1',
      '-vf',
      'scale=1920:-2',
      '-q:v',
      '2',
      '/output/frame-0.jpg'
    ]);
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

      const expectedFrames = [0, 3, 6, 9, 12, 15, 16].map((timestamp) => ({
        timestampSeconds: timestamp,
        thumbnailPath: path.join(outputDir, `foo-bar-${timestamp}.jpg`)
      }));

      expect(frames).toEqual(expectedFrames);
      expect(execaMock).toHaveBeenCalledTimes(7);
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
        '-q:v',
        '2',
        path.join(outputDir, 'foo-bar-0.jpg')
      ]);
      expect(execaMock).toHaveBeenNthCalledWith(2, 'ffmpeg', [
        '-y',
        '-ss',
        '3',
        '-i',
        '/input/video.mp4',
        '-frames:v',
        '1',
        '-q:v',
        '2',
        path.join(outputDir, 'foo-bar-3.jpg')
      ]);
      expect(execaMock).toHaveBeenNthCalledWith(3, 'ffmpeg', [
        '-y',
        '-ss',
        '6',
        '-i',
        '/input/video.mp4',
        '-frames:v',
        '1',
        '-q:v',
        '2',
        path.join(outputDir, 'foo-bar-6.jpg')
      ]);
    } finally {
      await rm(outputDir, { force: true, recursive: true });
    }
  });
});

describe('createMockAiProvider', () => {
  it('returns deterministic cutting tags for cutting image names', async () => {
    const provider = createMockAiProvider();

    await expect(provider.analyzeImage({ imagePath: '/tmp/factory_cutting.jpg' })).resolves.toEqual({
      tags: [
        { displayName: '裁剪布料', confidence: 0.88 },
        { displayName: '牛仔布', confidence: 0.82 }
      ]
    });
  });

  it('returns deterministic cutting tags for cut image names', async () => {
    const provider = createMockAiProvider();

    const result = await provider.analyzeImage({ imagePath: '/tmp/factory_cut.jpg' });

    expect(result.tags[0]).toEqual({ displayName: '裁剪布料', confidence: 0.88 });
    expect(result.tags).toContainEqual({ displayName: '牛仔布', confidence: 0.82 });
  });

  it('returns deterministic sewing tags for sewing image names', async () => {
    const provider = createMockAiProvider();

    await expect(provider.analyzeImage({ imagePath: '/tmp/sewing_station.jpg' })).resolves.toEqual({
      tags: [
        { displayName: '缝纫机', confidence: 0.87 },
        { displayName: '人物', confidence: 0.76 }
      ]
    });
  });

  it('falls back to a generic material tag for unknown image names', async () => {
    const provider = createMockAiProvider();

    await expect(provider.analyzeImage({ imagePath: '/tmp/misc.jpg' })).resolves.toEqual({
      tags: [{ displayName: '素材', confidence: 0.5 }]
    });
  });

  it('returns deterministic Russian transcript segments for ru audio names', async () => {
    const provider = createMockAiProvider();

    await expect(provider.transcribeAudio({ audioPath: '/tmp/worker_talk_ru.wav' })).resolves.toEqual({
      segments: [
        {
          startSeconds: 0,
          endSeconds: 4,
          language: 'ru',
          text: 'Пример разговора о ткани',
          translation: '关于面料的示例谈话'
        }
      ]
    });
  });

  it('returns deterministic Chinese transcript segments for non-ru audio names', async () => {
    const provider = createMockAiProvider();

    await expect(provider.transcribeAudio({ audioPath: '/tmp/worker_talk.wav' })).resolves.toEqual({
      segments: [
        {
          startSeconds: 0,
          endSeconds: 3,
          language: 'zh',
          text: '这是一段关于面料的示例谈话',
          translation: null
        }
      ]
    });
  });
});

describe('createOpenAiCompatibleProvider', () => {
  it.each([
    ['baseUrl', 'AI_OPENAI_BASE_URL'],
    ['apiKey', 'AI_OPENAI_API_KEY'],
    ['visionModel', 'AI_OPENAI_VISION_MODEL'],
    ['transcribeModel', 'AI_OPENAI_TRANSCRIBE_MODEL']
  ] as const)('reports the matching env name when %s is empty', (key, envName) => {
    expect(() =>
      createOpenAiCompatibleProvider({
        baseUrl: 'https://example.test/v1',
        apiKey: 'test-key',
        visionModel: 'vision-model',
        transcribeModel: 'transcribe-model',
        [key]: ''
      })
    ).toThrow(envName);
  });

  it('throws with status for non-ok vision responses before parsing JSON', async () => {
    const imagePath = path.join(await mkdtemp(path.join(os.tmpdir(), 'ai-provider-')), 'frame.jpg');
    const json = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await writeFile(imagePath, 'fake image');
      const provider = createOpenAiCompatibleProvider({
        baseUrl: 'https://example.test/v1',
        apiKey: 'test-key',
        visionModel: 'vision-model',
        transcribeModel: 'transcribe-model'
      });

      await expect(provider.analyzeImage({ imagePath })).rejects.toThrow(/503/);
      expect(json).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      await rm(path.dirname(imagePath), { force: true, recursive: true });
    }
  });

  it('requests vision analysis with simplified-Chinese tag prompt', async () => {
    const imagePath = path.join(await mkdtemp(path.join(os.tmpdir(), 'ai-provider-')), 'frame.jpg');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"tags":[{"displayName":"牛仔布","confidence":0.9}]}' } }]
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await writeFile(imagePath, 'fake image');
      const provider = createOpenAiCompatibleProvider({
        baseUrl: 'https://example.test/v1',
        apiKey: 'test-key',
        visionModel: 'vision-model',
        transcribeModel: 'transcribe-model'
      });

      await provider.analyzeImage({ imagePath });

      const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
        messages?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
      };
      const promptText = requestBody.messages?.[0]?.content?.find((part) => part.type === 'text')?.text ?? '';
      expect(promptText).toMatch(/简体中文/);
      expect(promptText).toMatch(/displayName/i);
    } finally {
      vi.unstubAllGlobals();
      await rm(path.dirname(imagePath), { force: true, recursive: true });
    }
  });

  it('parses Chinese tag displayName from vision response', async () => {
    const imagePath = path.join(await mkdtemp(path.join(os.tmpdir(), 'ai-provider-')), 'frame.jpg');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                '{"tags":[{"displayName":"裁剪布料","confidence":0.88},{"displayName":"缝纫机","confidence":0.76}]}'
            }
          }
        ]
      })
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await writeFile(imagePath, 'fake image');
      const provider = createOpenAiCompatibleProvider({
        baseUrl: 'https://example.test/v1',
        apiKey: 'test-key',
        visionModel: 'vision-model',
        transcribeModel: 'transcribe-model'
      });

      await expect(provider.analyzeImage({ imagePath })).resolves.toEqual({
        tags: [
          { displayName: '裁剪布料', confidence: 0.88 },
          { displayName: '缝纫机', confidence: 0.76 }
        ]
      });
    } finally {
      vi.unstubAllGlobals();
      await rm(path.dirname(imagePath), { force: true, recursive: true });
    }
  });

  it('throws with status for non-ok transcription responses before parsing JSON', async () => {
    const audioPath = path.join(await mkdtemp(path.join(os.tmpdir(), 'ai-provider-')), 'audio.wav');
    const json = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await writeFile(audioPath, 'fake audio');
      const provider = createOpenAiCompatibleProvider({
        baseUrl: 'https://example.test/v1',
        apiKey: 'test-key',
        visionModel: 'vision-model',
        transcribeModel: 'transcribe-model'
      });

      await expect(provider.transcribeAudio({ audioPath })).rejects.toThrow(/429/);
      expect(json).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      await rm(path.dirname(audioPath), { force: true, recursive: true });
    }
  });

  it('normalizes base URLs without /v1 before calling audio transcriptions', async () => {
    const audioPath = path.join(await mkdtemp(path.join(os.tmpdir(), 'ai-provider-')), 'audio.wav');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: '你好', language: 'zh' })
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await writeFile(audioPath, 'fake audio');
      const provider = createOpenAiCompatibleProvider({
        baseUrl: 'https://example.test',
        apiKey: 'test-key',
        visionModel: 'vision-model',
        transcribeModel: 'transcribe-model'
      });

      await provider.transcribeAudio({ audioPath });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://example.test/v1/audio/transcriptions',
        expect.objectContaining({ method: 'POST' })
      );
    } finally {
      vi.unstubAllGlobals();
      await rm(path.dirname(audioPath), { force: true, recursive: true });
    }
  });
});
