import { transcribeAudioWithDashScopeAsr } from './dashscopeAsrProvider';
import { transcribeAudioWithGemini } from './geminiProvider';
import { transcribeAudioWithOpenAiCompatible } from './openAiCompatibleProvider';
import type { FallbackTranscriptionConfig } from './transcriptionFallbackConfig';

export async function transcribeWithFallbackConfig(
  fallback: FallbackTranscriptionConfig,
  input: { audioPath: string }
) {
  if (fallback.provider === 'dashscope-asr') {
    return transcribeAudioWithDashScopeAsr(fallback, input);
  }

  if (fallback.provider === 'gemini') {
    const { provider: _provider, ...config } = fallback;
    return transcribeAudioWithGemini(config, input);
  }

  const { provider: _provider, ...config } = fallback;
  return transcribeAudioWithOpenAiCompatible(config, input);
}

export function describeMissingFallbackConfig(
  provider: FallbackTranscriptionConfig['provider'] | null
): string {
  if (provider === 'dashscope-asr') {
    return '已选择百炼 DashScope 转写，但未配置完整的备选信息（API Key、模型）。请在设置页填写。';
  }

  if (provider === 'gemini') {
    return '已选择 Gemini 转写，但未配置完整的备选信息（API Key、模型）。请在设置页填写。';
  }

  return '已选择仅备选转写，但未配置备选 API 端点与模型。请在设置页填写备选转写配置。';
}
