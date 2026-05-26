export type AiProviderName = 'mock' | 'openai-compatible';
export type ApiProtocol = 'openai' | 'anthropic' | 'azure' | 'custom';

export interface AppSettings {
  apiProtocol: ApiProtocol;
  apiEndpoint: string;
  apiKeyConfigured: boolean;
  aiProviderName: AiProviderName;
  openAiVisionModel: string;
  openAiTranscribeModel: string;
  dailyBudgetYuan: number;
  concurrentTasks: number;
  precisionModeDefault: boolean;
  reuseParsedResults: boolean;
  dailySpendYuan: number;
  updatedAt: string;
}

export interface AppSettingsPatch {
  apiProtocol?: ApiProtocol;
  apiEndpoint?: string;
  apiKey?: string;
  aiProviderName?: AiProviderName;
  openAiVisionModel?: string;
  openAiTranscribeModel?: string;
  dailyBudgetYuan?: number;
  concurrentTasks?: number;
  precisionModeDefault?: boolean;
  reuseParsedResults?: boolean;
}

export interface TestAiConnectionInput {
  apiProtocol?: ApiProtocol;
  apiEndpoint?: string;
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
