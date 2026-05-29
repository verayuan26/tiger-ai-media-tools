import type { AiProvider } from './provider';
import { isTranscriptionUnsupportedError } from './transcriptionErrors';
import type { FallbackTranscriptionConfig } from './transcriptionFallbackConfig';
import {
  describeMissingFallbackConfig,
  transcribeWithFallbackConfig
} from './transcribeWithFallback';
import type { TranscriptionMode } from '../../shared/settings';

export type { TranscriptionMode };

export function loadTranscriptionModeFromEnv(): TranscriptionMode {
  const raw = process.env.AI_TRANSCRIPTION_MODE?.trim().toLowerCase();
  if (raw === 'cloud' || raw === 'fallback' || raw === 'auto') {
    return raw;
  }

  if (raw === 'local') {
    return 'auto';
  }

  return 'auto';
}

export function withTranscriptionFallback(
  provider: AiProvider,
  options: {
    mode?: TranscriptionMode;
    fallback?: FallbackTranscriptionConfig | null;
  } = {}
): AiProvider {
  const mode = options.mode ?? loadTranscriptionModeFromEnv();
  const fallback = options.fallback ?? null;

  return {
    analyzeImage: (input) => provider.analyzeImage(input),

    async transcribeAudio(input) {
      if (mode === 'fallback') {
        return transcribeWithConfiguredFallback(fallback, input);
      }

      try {
        return await provider.transcribeAudio(input);
      } catch (error) {
        if (mode === 'auto' && isTranscriptionUnsupportedError(error) && fallback) {
          return transcribeWithFallbackConfig(fallback, input);
        }

        if (mode === 'auto' && isTranscriptionUnsupportedError(error)) {
          throw augmentUnsupportedError(error);
        }

        throw error;
      }
    }
  };
}

async function transcribeWithConfiguredFallback(
  fallback: FallbackTranscriptionConfig | null,
  input: { audioPath: string }
) {
  if (!fallback) {
    throw new Error(describeMissingFallbackConfig(null));
  }

  return transcribeWithFallbackConfig(fallback, input);
}

function augmentUnsupportedError(error: import('./transcriptionErrors').TranscriptionUnsupportedError): Error {
  return new Error(
    `${error.message} 请在设置页配置「备选转写」并选择「自动降级」或「仅备选转写」。`
  );
}
