export type AiProviderName = 'mock' | 'openai-compatible';
export type ApiProtocol = 'openai' | 'anthropic' | 'azure' | 'gemini' | 'custom';

const API_PROTOCOLS: ApiProtocol[] = ['openai', 'anthropic', 'azure', 'gemini', 'custom'];

export function parseApiProtocol(value: unknown): ApiProtocol | null {
  const raw = String(value ?? '').trim().toLowerCase();
  if ((API_PROTOCOLS as string[]).includes(raw)) {
    return raw as ApiProtocol;
  }

  return null;
}
export type TranscriptionMode = 'cloud' | 'fallback' | 'auto';
export type FallbackTranscribeProvider = 'openai-compatible' | 'dashscope-asr' | 'gemini';

export interface AppSettings {
  apiProtocol: ApiProtocol;
  apiEndpoint: string;
  /** Empty string means use HTTP_PROXY / HTTPS_PROXY from the environment. */
  apiProxyUrl: string;
  apiKeyConfigured: boolean;
  aiProviderName: AiProviderName;
  openAiVisionModel: string;
  openAiTranscribeModel: string;
  transcriptionMode: TranscriptionMode;
  fallbackTranscribeProvider: FallbackTranscribeProvider;
  fallbackTranscribeEndpoint: string;
  fallbackTranscribeModel: string;
  fallbackTranscribeApiKeyConfigured: boolean;
  dailyBudgetYuan: number;
  concurrentTasks: number;
  precisionModeDefault: boolean;
  reuseParsedResults: boolean;
  dailySpendYuan: number;
  ffmpegPath: string;
  updatedAt: string;
}

export interface AppSettingsPatch {
  apiProtocol?: ApiProtocol;
  apiEndpoint?: string;
  apiProxyUrl?: string;
  apiKey?: string;
  aiProviderName?: AiProviderName;
  openAiVisionModel?: string;
  openAiTranscribeModel?: string;
  transcriptionMode?: TranscriptionMode;
  fallbackTranscribeProvider?: FallbackTranscribeProvider;
  fallbackTranscribeEndpoint?: string;
  fallbackTranscribeModel?: string;
  fallbackTranscribeApiKey?: string;
  dailyBudgetYuan?: number;
  concurrentTasks?: number;
  precisionModeDefault?: boolean;
  reuseParsedResults?: boolean;
  ffmpegPath?: string;
}

export interface TestAiConnectionInput {
  apiProtocol?: ApiProtocol;
  apiEndpoint?: string;
  apiProxyUrl?: string;
  apiKey?: string;
  aiProviderName?: AiProviderName;
  openAiVisionModel?: string;
  openAiTranscribeModel?: string;
}

export interface TestAiConnectionResult {
  ok: boolean;
  provider: AiProviderName;
  message: string;
}

export interface DrainBlockedInfo {
  code: 'daily_budget_exceeded' | 'concurrent_limit_reached';
  message: string;
}
