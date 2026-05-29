import type { FallbackTranscriptionConfig } from './transcriptionFallbackConfig';
import { parseFallbackTranscribeProvider } from './transcriptionFallbackConfig';
import { normalizeOpenAiCompatibleBaseUrl } from './openAiCompatibleProvider';
import { normalizeDashScopeApiBaseUrl } from './dashscopeAsrProvider';

export function loadFallbackTranscriptionConfigFromEnv(
  primaryApiKey: string
): FallbackTranscriptionConfig | null {
  const provider = parseFallbackTranscribeProvider(
    process.env.AI_FALLBACK_TRANSCRIBE_PROVIDER?.trim().toLowerCase() || 'dashscope-asr'
  );
  const transcribeModel =
    process.env.AI_FALLBACK_TRANSCRIBE_MODEL?.trim() ||
    (provider === 'dashscope-asr' ? 'qwen3-asr-flash-filetrans' : '');
  const fallbackApiKey = process.env.AI_FALLBACK_TRANSCRIBE_API_KEY?.trim() || '';

  if (!transcribeModel) {
    return null;
  }

  if (provider === 'dashscope-asr') {
    if (!fallbackApiKey) {
      return null;
    }

    return {
      provider,
      apiBaseUrl: normalizeDashScopeApiBaseUrl(
        process.env.AI_FALLBACK_TRANSCRIBE_ENDPOINT?.trim() || ''
      ),
      apiKey: fallbackApiKey,
      transcribeModel
    };
  }

  const endpoint = process.env.AI_FALLBACK_TRANSCRIBE_ENDPOINT?.trim() || '';
  const apiKey = fallbackApiKey || primaryApiKey.trim();
  if (!endpoint || !apiKey) {
    return null;
  }

  return {
    provider: 'openai-compatible',
    baseUrl: normalizeOpenAiCompatibleBaseUrl(endpoint),
    apiKey,
    transcribeModel
  };
}
