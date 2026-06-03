import type { FallbackTranscribeProvider } from '../../shared/settings';
import type { OpenAiTranscriptionConfig } from './openAiCompatibleProvider';
import type { DashScopeAsrConfig } from './dashscopeAsrProvider';
import type { GeminiTranscriptionConfig } from './geminiProvider';

export type FallbackTranscriptionConfig =
  | ({ provider: 'openai-compatible' } & OpenAiTranscriptionConfig)
  | ({ provider: 'dashscope-asr' } & DashScopeAsrConfig)
  | ({ provider: 'gemini' } & GeminiTranscriptionConfig);

export function parseFallbackTranscribeProvider(value: unknown): FallbackTranscribeProvider {
  const raw = String(value ?? 'dashscope-asr');
  if (raw === 'dashscope-asr' || raw === 'dashscope-filetrans') {
    return 'dashscope-asr';
  }

  if (raw === 'openai-compatible') {
    return 'openai-compatible';
  }

  if (raw === 'gemini') {
    return 'gemini';
  }

  return 'dashscope-asr';
}
