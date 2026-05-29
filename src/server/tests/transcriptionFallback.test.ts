import { describe, expect, it, vi } from 'vitest';
import {
  parseDashScopeTranscription,
  normalizeDashScopeApiBaseUrl,
  resolveDashScopeTaskPollOutcome
} from '../ai/dashscopeAsrProvider';
import {
  isNoValidSpeechFragment,
  TranscriptionUnsupportedError
} from '../ai/transcriptionErrors';
import { withTranscriptionFallback } from '../ai/withTranscriptionFallback';
import type { AiProvider } from '../ai/provider';

describe('withTranscriptionFallback', () => {
  it('falls back to openai-compatible transcription when primary returns 404', async () => {
    const cloud: AiProvider = {
      analyzeImage: vi.fn(),
      transcribeAudio: vi.fn(async () => {
        throw new TranscriptionUnsupportedError(404, 'http://agent.test/v1/audio/transcriptions');
      })
    };
    const fallbackTranscribe = vi.fn(async () => ({
      segments: [
        {
          startSeconds: 0,
          endSeconds: 1,
          language: 'zh',
          text: '备选云端转写',
          translation: null
        }
      ]
    }));

    const provider = withTranscriptionFallback(cloud, {
      mode: 'auto',
      fallback: {
        provider: 'openai-compatible',
        baseUrl: 'https://fallback.test/v1',
        apiKey: 'fallback-key',
        transcribeModel: 'whisper-1'
      }
    });

    const original = await import('../ai/openAiCompatibleProvider');
    const spy = vi
      .spyOn(original, 'transcribeAudioWithOpenAiCompatible')
      .mockImplementation(fallbackTranscribe);

    try {
      await expect(provider.transcribeAudio({ audioPath: '/tmp/audio.wav' })).resolves.toEqual({
        segments: [
          {
            startSeconds: 0,
            endSeconds: 1,
            language: 'zh',
            text: '备选云端转写',
            translation: null
          }
        ]
      });
      expect(fallbackTranscribe).toHaveBeenCalledWith(
        {
          baseUrl: 'https://fallback.test/v1',
          apiKey: 'fallback-key',
          transcribeModel: 'whisper-1'
        },
        { audioPath: '/tmp/audio.wav' }
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('falls back to dashscope-asr when primary returns 404', async () => {
    const cloud: AiProvider = {
      analyzeImage: vi.fn(),
      transcribeAudio: vi.fn(async () => {
        throw new TranscriptionUnsupportedError(404, 'http://agent.test/v1/audio/transcriptions');
      })
    };
    const fallbackTranscribe = vi.fn(async () => ({
      segments: [
        {
          startSeconds: 0,
          endSeconds: 2.5,
          language: 'zh',
          text: '百炼转写结果',
          translation: null
        }
      ]
    }));

    const provider = withTranscriptionFallback(cloud, {
      mode: 'auto',
      fallback: {
        provider: 'dashscope-asr',
        apiBaseUrl: 'https://dashscope.aliyuncs.com/api/v1',
        apiKey: 'dashscope-key',
        transcribeModel: 'qwen3-asr-flash-filetrans'
      }
    });

    const original = await import('../ai/dashscopeAsrProvider');
    const spy = vi.spyOn(original, 'transcribeAudioWithDashScopeAsr').mockImplementation(fallbackTranscribe);

    try {
      await expect(provider.transcribeAudio({ audioPath: '/tmp/audio.wav' })).resolves.toEqual({
        segments: [
          {
            startSeconds: 0,
            endSeconds: 2.5,
            language: 'zh',
            text: '百炼转写结果',
            translation: null
          }
        ]
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('rethrows primary errors in cloud-only mode', async () => {
    const provider = withTranscriptionFallback(
      {
        analyzeImage: vi.fn(),
        transcribeAudio: vi.fn(async () => {
          throw new TranscriptionUnsupportedError(404, 'http://agent.test/v1/audio/transcriptions');
        })
      },
      {
        mode: 'cloud',
        fallback: {
          provider: 'openai-compatible',
          baseUrl: 'https://fallback.test/v1',
          apiKey: 'fallback-key',
          transcribeModel: 'whisper-1'
        }
      }
    );

    await expect(provider.transcribeAudio({ audioPath: '/tmp/audio.wav' })).rejects.toBeInstanceOf(
      TranscriptionUnsupportedError
    );
  });
});

describe('normalizeDashScopeApiBaseUrl', () => {
  it('fixes compatible-mode and full transcription paths', () => {
    expect(normalizeDashScopeApiBaseUrl('https://dashscope.aliyuncs.com/compatible-mode/v1')).toBe(
      'https://dashscope.aliyuncs.com/api/v1'
    );
    expect(
      normalizeDashScopeApiBaseUrl(
        'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription'
      )
    ).toBe('https://dashscope.aliyuncs.com/api/v1');
    expect(normalizeDashScopeApiBaseUrl('')).toBe('https://dashscope.aliyuncs.com/api/v1');
  });
});

describe('parseDashScopeTranscription', () => {
  it('maps sentence timestamps from milliseconds to seconds', () => {
    expect(
      parseDashScopeTranscription({
        transcripts: [
          {
            sentences: [
              {
                begin_time: 760,
                end_time: 3240,
                text: 'Hello World'
              }
            ]
          }
        ]
      })
    ).toEqual({
      segments: [
        {
          startSeconds: 0.76,
          endSeconds: 3.24,
          language: 'zh',
          text: 'Hello World',
          translation: null
        }
      ]
    });
  });
});

describe('resolveDashScopeTaskPollOutcome', () => {
  it('treats FAILED with SUCCESS_WITH_NO_VALID_FRAGMENT as no speech', () => {
    expect(
      resolveDashScopeTaskPollOutcome({
        task_status: 'FAILED',
        message: 'SUCCESS_WITH_NO_VALID_FRAGMENT'
      })
    ).toEqual({
      type: 'no_speech',
      detail: 'SUCCESS_WITH_NO_VALID_FRAGMENT'
    });
  });

  it('treats succeeded subtasks without transcription url as no speech', () => {
    expect(
      resolveDashScopeTaskPollOutcome({
        task_status: 'SUCCEEDED',
        results: [
          {
            subtask_status: 'FAILED',
            message: 'SUCCESS_WITH_NO_VALID_FRAGMENT'
          }
        ]
      })
    ).toEqual({
      type: 'no_speech',
      detail: 'SUCCESS_WITH_NO_VALID_FRAGMENT FAILED'
    });
  });
});

describe('isNoValidSpeechFragment', () => {
  it('matches dashscope no-speech codes case-insensitively', () => {
    expect(isNoValidSpeechFragment('SUCCESS_WITH_NO_VALID_FRAGMENT')).toBe(true);
    expect(isNoValidSpeechFragment('success_with_no_valid_fragment')).toBe(true);
    expect(isNoValidSpeechFragment('network error')).toBe(false);
  });
});
