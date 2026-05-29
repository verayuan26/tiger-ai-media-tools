import type { FallbackTranscriptionConfig } from '../ai/transcriptionFallbackConfig';
import { parseFallbackTranscribeProvider } from '../ai/transcriptionFallbackConfig';
import { normalizeOpenAiCompatibleBaseUrl } from '../ai/openAiCompatibleProvider';
import { normalizeDashScopeApiBaseUrl } from '../ai/dashscopeAsrProvider';
import type { LibraryDatabase } from './connection';
import type {
  AiProviderName,
  ApiProtocol,
  AppSettings,
  AppSettingsPatch,
  FallbackTranscribeProvider,
  TranscriptionMode
} from '../../shared/settings';
import { nowIso } from './repositories';

const SETTINGS_ID = 'default';

type Row = Record<string, unknown>;

export interface SettingsSeed {
  aiProviderName: AiProviderName;
  apiEndpoint: string;
  apiKey: string;
  openAiVisionModel: string;
  openAiTranscribeModel: string;
  transcriptionMode?: TranscriptionMode;
  fallbackTranscribeProvider?: FallbackTranscribeProvider;
  fallbackTranscribeEndpoint?: string;
  fallbackTranscribeModel?: string;
  fallbackTranscribeApiKey?: string;
  dailyBudgetYuan: number;
}

export interface ResolvedAiCredentials {
  aiProviderName: AiProviderName;
  baseUrl: string;
  apiKey: string;
  visionModel: string;
  transcribeModel: string;
}

export function createSettingsRepository(db: LibraryDatabase, seed: SettingsSeed) {
  ensureRow(db, seed);

  return {
    get(): AppSettings {
      return mapPublic(readRow(db));
    },

    patch(input: AppSettingsPatch): AppSettings {
      const current = readRow(db);
      const nextApiKey =
        input.apiKey !== undefined ? input.apiKey.trim() : String(current.api_key ?? '');
      const nextFallbackApiKey =
        input.fallbackTranscribeApiKey !== undefined
          ? input.fallbackTranscribeApiKey.trim()
          : String(current.fallback_transcribe_api_key ?? '');

      db.prepare(
        `update app_settings
         set api_protocol = ?,
             api_endpoint = ?,
             api_key = ?,
             ai_provider_name = ?,
             open_ai_vision_model = ?,
             open_ai_transcribe_model = ?,
             transcription_mode = ?,
             fallback_transcribe_provider = ?,
             fallback_transcribe_endpoint = ?,
             fallback_transcribe_model = ?,
             fallback_transcribe_api_key = ?,
             daily_budget_yuan = ?,
             concurrent_tasks = ?,
             precision_mode_default = ?,
             reuse_parsed_results = ?,
             updated_at = ?
         where id = ?`
      ).run(
        input.apiProtocol ?? String(current.api_protocol),
        input.apiEndpoint ?? String(current.api_endpoint),
        nextApiKey,
        input.aiProviderName ?? String(current.ai_provider_name),
        input.openAiVisionModel !== undefined
          ? input.openAiVisionModel.trim()
          : String(current.open_ai_vision_model ?? ''),
        input.openAiTranscribeModel !== undefined
          ? input.openAiTranscribeModel.trim()
          : String(current.open_ai_transcribe_model ?? ''),
        input.transcriptionMode ?? String(current.transcription_mode ?? 'auto'),
        input.fallbackTranscribeProvider !== undefined
          ? input.fallbackTranscribeProvider
          : parseFallbackTranscribeProvider(current.fallback_transcribe_provider),
        input.fallbackTranscribeEndpoint !== undefined
          ? input.fallbackTranscribeProvider === 'dashscope-asr' ||
            parseFallbackTranscribeProvider(
              input.fallbackTranscribeProvider ?? current.fallback_transcribe_provider
            ) === 'dashscope-asr'
            ? normalizeDashScopeApiBaseUrl(input.fallbackTranscribeEndpoint.trim())
            : input.fallbackTranscribeEndpoint.trim()
          : String(current.fallback_transcribe_endpoint ?? ''),
        input.fallbackTranscribeModel !== undefined
          ? input.fallbackTranscribeModel.trim()
          : String(current.fallback_transcribe_model ?? ''),
        nextFallbackApiKey,
        input.dailyBudgetYuan ?? Number(current.daily_budget_yuan),
        input.concurrentTasks ?? Number(current.concurrent_tasks),
        input.precisionModeDefault === undefined
          ? Number(current.precision_mode_default)
          : input.precisionModeDefault
            ? 1
            : 0,
        input.reuseParsedResults === undefined
          ? Number(current.reuse_parsed_results)
          : input.reuseParsedResults
            ? 1
            : 0,
        nowIso(),
        SETTINGS_ID
      );

      return mapPublic(readRow(db));
    },

    resolveAiCredentials(overrides: Partial<ResolvedAiCredentials> = {}): ResolvedAiCredentials {
      const row = readRow(db);
      const aiProviderName =
        overrides.aiProviderName ?? (String(row.ai_provider_name) as AiProviderName);
      const baseUrl = (overrides.baseUrl ?? String(row.api_endpoint)).replace(/\/+$/, '');
      const apiKey = overrides.apiKey ?? String(row.api_key ?? '');
      const visionModel =
        overrides.visionModel?.trim() || String(row.open_ai_vision_model ?? '').trim();
      const transcribeModel =
        overrides.transcribeModel?.trim() || String(row.open_ai_transcribe_model ?? '').trim();

      return { aiProviderName, baseUrl, apiKey, visionModel, transcribeModel };
    },

    resolveFallbackTranscribeCredentials(): FallbackTranscriptionConfig | null {
      const row = readRow(db);
      const provider = parseFallbackTranscribeProvider(row.fallback_transcribe_provider);
      const transcribeModel = String(row.fallback_transcribe_model ?? '').trim();
      const fallbackApiKey = String(row.fallback_transcribe_api_key ?? '').trim();

      if (!transcribeModel) {
        return null;
      }

      if (provider === 'dashscope-asr') {
        if (!fallbackApiKey) {
          return null;
        }

        return {
          provider,
          apiBaseUrl: normalizeDashScopeApiBaseUrl(String(row.fallback_transcribe_endpoint ?? '')),
          apiKey: fallbackApiKey,
          transcribeModel
        };
      }

      const endpoint = String(row.fallback_transcribe_endpoint ?? '').trim();
      if (!endpoint) {
        return null;
      }

      const primaryApiKey = String(row.api_key ?? '').trim();
      const apiKey = fallbackApiKey || primaryApiKey;
      if (!apiKey) {
        return null;
      }

      return {
        provider: 'openai-compatible',
        baseUrl: normalizeOpenAiCompatibleBaseUrl(endpoint),
        apiKey,
        transcribeModel
      };
    },

    getConcurrentTasksLimit(): number {
      return Number(readRow(db).concurrent_tasks);
    },

    getDailyBudgetCents(): number {
      return Number(readRow(db).daily_budget_yuan) * 100;
    },

    getDailySpendCents(): number {
      resetSpendIfNewDay(db);
      return Number(readRow(db).daily_spend_cents);
    },

    recordAiSpend(cents: number): void {
      resetSpendIfNewDay(db);
      db.prepare(
        `update app_settings
         set daily_spend_cents = daily_spend_cents + ?,
             updated_at = ?
         where id = ?`
      ).run(cents, nowIso(), SETTINGS_ID);
    },

    isPrecisionModeDefault(): boolean {
      return Boolean(readRow(db).precision_mode_default);
    }
  };
}

function ensureRow(db: LibraryDatabase, seed: SettingsSeed): void {
  const existing = db.prepare('select id from app_settings where id = ?').get(SETTINGS_ID);
  if (existing) return;

  const today = todayKey();
  db.prepare(
    `insert into app_settings (
       id, api_protocol, api_endpoint, api_key, ai_provider_name,
       open_ai_vision_model, open_ai_transcribe_model,
       transcription_mode, fallback_transcribe_provider, fallback_transcribe_endpoint, fallback_transcribe_model,
       fallback_transcribe_api_key,
       daily_budget_yuan, concurrent_tasks, precision_mode_default, reuse_parsed_results,
       daily_spend_cents, spend_day, updated_at
     ) values (?, 'openai', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 3, 0, 1, 0, ?, ?)`
  ).run(
    SETTINGS_ID,
    seed.apiEndpoint,
    seed.apiKey,
    seed.aiProviderName,
    seed.openAiVisionModel,
    seed.openAiTranscribeModel,
    seed.transcriptionMode ?? 'auto',
    seed.fallbackTranscribeProvider ?? 'dashscope-asr',
    seed.fallbackTranscribeEndpoint ?? '',
    seed.fallbackTranscribeModel ?? '',
    seed.fallbackTranscribeApiKey ?? '',
    seed.dailyBudgetYuan,
    today,
    nowIso()
  );
}

function readRow(db: LibraryDatabase): Row {
  resetSpendIfNewDay(db);
  const row = db.prepare('select * from app_settings where id = ?').get(SETTINGS_ID) as Row | undefined;
  if (!row) {
    throw new Error('app_settings row is missing');
  }
  return row;
}

function mapPublic(row: Row): AppSettings {
  const apiKey = String(row.api_key ?? '');
  const fallbackApiKey = String(row.fallback_transcribe_api_key ?? '');
  return {
    apiProtocol: String(row.api_protocol) as ApiProtocol,
    apiEndpoint: String(row.api_endpoint),
    apiKeyConfigured: apiKey.length > 0,
    aiProviderName: String(row.ai_provider_name) as AiProviderName,
    openAiVisionModel: String(row.open_ai_vision_model ?? ''),
    openAiTranscribeModel: String(row.open_ai_transcribe_model ?? ''),
    transcriptionMode: parseTranscriptionMode(row.transcription_mode),
    fallbackTranscribeProvider: parseFallbackTranscribeProvider(row.fallback_transcribe_provider),
    fallbackTranscribeEndpoint: String(row.fallback_transcribe_endpoint ?? ''),
    fallbackTranscribeModel: String(row.fallback_transcribe_model ?? ''),
    fallbackTranscribeApiKeyConfigured: fallbackApiKey.length > 0,
    dailyBudgetYuan: Number(row.daily_budget_yuan),
    concurrentTasks: Number(row.concurrent_tasks),
    precisionModeDefault: Boolean(row.precision_mode_default),
    reuseParsedResults: Boolean(row.reuse_parsed_results),
    dailySpendYuan: Number(row.daily_spend_cents) / 100,
    updatedAt: String(row.updated_at)
  };
}

function resetSpendIfNewDay(db: LibraryDatabase): void {
  const today = todayKey();
  const row = db.prepare('select spend_day from app_settings where id = ?').get(SETTINGS_ID) as
    | { spend_day: string }
    | undefined;

  if (!row || row.spend_day === today) return;

  db.prepare(
    `update app_settings
     set daily_spend_cents = 0,
         spend_day = ?,
         updated_at = ?
     where id = ?`
  ).run(today, nowIso(), SETTINGS_ID);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseTranscriptionMode(value: unknown): TranscriptionMode {
  const raw = String(value ?? 'auto');
  if (raw === 'cloud' || raw === 'fallback' || raw === 'auto') {
    return raw;
  }

  if (raw === 'local') {
    return 'auto';
  }

  return 'auto';
}
