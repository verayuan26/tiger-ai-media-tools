import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';
import { parseApiProtocol, type ApiProtocol } from '../shared/settings';

const aiProviderNameSchema = z.enum(['mock', 'openai-compatible']);

export interface AppConfig {
  dataDir: string;
  port: number;
  aiProviderName: z.infer<typeof aiProviderNameSchema>;
  apiProtocol: ApiProtocol;
  enableDevRoutes: boolean;
  openAiBaseUrl: string;
  openAiApiKey: string;
  openAiVisionModel: string;
  openAiTranscribeModel: string;
}

export type ConfigOverrides = Partial<AppConfig>;

export function loadConfig(overrides: ConfigOverrides = {}): AppConfig {
  const envProviderName = aiProviderNameSchema.safeParse(process.env.AI_PROVIDER);

  const apiProtocol =
    overrides.apiProtocol ?? parseApiProtocol(process.env.AI_API_PROTOCOL) ?? 'openai';

  return {
    dataDir: path.resolve(overrides.dataDir ?? process.env.AI_MEDIA_DATA_DIR ?? '.data'),
    port: overrides.port ?? Number(process.env.AI_MEDIA_PORT ?? 8787),
    aiProviderName: overrides.aiProviderName ?? (envProviderName.success ? envProviderName.data : 'mock'),
    apiProtocol,
    enableDevRoutes: overrides.enableDevRoutes ?? process.env.AI_MEDIA_ENABLE_DEV_ROUTES === '1',
    openAiBaseUrl:
      overrides.openAiBaseUrl ??
      process.env.AI_OPENAI_BASE_URL ??
      (apiProtocol === 'gemini'
        ? 'https://generativelanguage.googleapis.com/v1beta'
        : 'https://api.openai.com/v1'),
    openAiApiKey: overrides.openAiApiKey ?? process.env.AI_OPENAI_API_KEY ?? '',
    openAiVisionModel: overrides.openAiVisionModel ?? process.env.AI_OPENAI_VISION_MODEL ?? '',
    openAiTranscribeModel: overrides.openAiTranscribeModel ?? process.env.AI_OPENAI_TRANSCRIBE_MODEL ?? ''
  };
}
