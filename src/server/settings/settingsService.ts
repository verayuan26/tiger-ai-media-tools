import type { AppConfig } from '../config';
import type { AiProvider } from '../ai/provider';
import { createMockAiProvider } from '../ai/mockProvider';
import {
  createOpenAiCompatibleProvider,
  normalizeOpenAiCompatibleBaseUrl,
  pingOpenAiCompatibleProvider,
  type OpenAiCompatibleProviderConfig
} from '../ai/openAiCompatibleProvider';
import type {
  createSettingsRepository,
  ResolvedAiCredentials
} from '../db/settingsRepository';
import type {
  AppSettingsPatch,
  DrainBlockedInfo,
  TestAiConnectionInput,
  TestAiConnectionResult
} from '../../shared/settings';
import type { AnalysisJob } from '../../shared/types';

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;

const AI_JOB_COST_CENTS = Number(process.env.AI_JOB_COST_CENTS ?? 10);

export function createSettingsService(config: AppConfig, settingsRepo: SettingsRepository) {
  return {
    getSettings() {
      return settingsRepo.get();
    },

    patchSettings(input: AppSettingsPatch) {
      return settingsRepo.patch(input);
    },

    async testAiConnection(input: TestAiConnectionInput = {}): Promise<TestAiConnectionResult> {
      const resolved = resolveCredentials(settingsRepo, config, input);

      if (resolved.aiProviderName === 'mock') {
        return {
          ok: true,
          provider: 'mock',
          message: 'Mock provider 已就绪，无需外网 API Key'
        };
      }

      try {
        await pingOpenAiCompatibleProvider(toOpenAiConfig(resolved));
        return {
          ok: true,
          provider: 'openai-compatible',
          message: '云端 AI 端点可达，凭证校验通过'
        };
      } catch (error) {
        return {
          ok: false,
          provider: 'openai-compatible',
          message: error instanceof Error ? error.message : String(error)
        };
      }
    },

    resolveAiProvider(overrides: Partial<ResolvedAiCredentials> = {}): AiProvider {
      const resolved = resolveCredentials(settingsRepo, config, overrides);
      if (resolved.aiProviderName === 'mock') {
        return createMockAiProvider();
      }

      return createOpenAiCompatibleProvider(toOpenAiConfig(resolved));
    },

    getFrameMode(): 'balanced' | 'precision' {
      return settingsRepo.isPrecisionModeDefault() ? 'precision' : 'balanced';
    },

    checkDrainLimits(processingCount: number): DrainBlockedInfo | null {
      const concurrentLimit = settingsRepo.getConcurrentTasksLimit();
      if (processingCount >= concurrentLimit) {
        return {
          code: 'concurrent_limit_reached',
          message: `并发任务已达上限（${concurrentLimit}），请等待当前任务完成后再试`
        };
      }

      const budgetCents = settingsRepo.getDailyBudgetCents();
      const spendCents = settingsRepo.getDailySpendCents();
      if (spendCents >= budgetCents) {
        return {
          code: 'daily_budget_exceeded',
          message: `今日 AI 预算已用尽（¥${budgetCents / 100}），新 AI 任务将暂停至次日`
        };
      }

      return null;
    },

    checkJobBudget(job: AnalysisJob): DrainBlockedInfo | null {
      if (!isAiStage(job.stage)) return null;

      const budgetCents = settingsRepo.getDailyBudgetCents();
      const spendCents = settingsRepo.getDailySpendCents();
      if (spendCents + AI_JOB_COST_CENTS > budgetCents) {
        return {
          code: 'daily_budget_exceeded',
          message: `今日 AI 预算不足，无法启动 ${job.stage} 任务`
        };
      }

      return null;
    },

    recordAiJobSpend(job: AnalysisJob): void {
      if (isAiStage(job.stage)) {
        settingsRepo.recordAiSpend(AI_JOB_COST_CENTS);
      }
    }
  };
}

function resolveCredentials(
  settingsRepo: SettingsRepository,
  config: AppConfig,
  overrides: TestAiConnectionInput | Partial<ResolvedAiCredentials> = {}
): ResolvedAiCredentials {
  const stored = settingsRepo.resolveAiCredentials();
  const endpointOverride =
    'apiEndpoint' in overrides
      ? overrides.apiEndpoint?.trim()
      : 'baseUrl' in overrides
        ? overrides.baseUrl?.trim()
        : undefined;
  const apiKeyOverride = overrides.apiKey?.trim();

  const visionModelOverride =
    'openAiVisionModel' in overrides ? overrides.openAiVisionModel?.trim() : undefined;
  const transcribeModelOverride =
    'openAiTranscribeModel' in overrides ? overrides.openAiTranscribeModel?.trim() : undefined;
  const visionModelOverrideFromLegacy =
    'visionModel' in overrides ? overrides.visionModel?.trim() : undefined;
  const transcribeModelOverrideFromLegacy =
    'transcribeModel' in overrides ? overrides.transcribeModel?.trim() : undefined;

  return {
    aiProviderName: overrides.aiProviderName ?? stored.aiProviderName,
    baseUrl: endpointOverride || stored.baseUrl || config.openAiBaseUrl,
    apiKey: apiKeyOverride || stored.apiKey || config.openAiApiKey,
    visionModel:
      visionModelOverride ||
      visionModelOverrideFromLegacy ||
      stored.visionModel ||
      config.openAiVisionModel,
    transcribeModel:
      transcribeModelOverride ||
      transcribeModelOverrideFromLegacy ||
      stored.transcribeModel ||
      config.openAiTranscribeModel
  };
}

function toOpenAiConfig(resolved: ResolvedAiCredentials): OpenAiCompatibleProviderConfig {
  return {
    baseUrl: normalizeOpenAiCompatibleBaseUrl(resolved.baseUrl),
    apiKey: resolved.apiKey,
    visionModel: resolved.visionModel,
    transcribeModel: resolved.transcribeModel
  };
}

function isAiStage(stage: AnalysisJob['stage']): boolean {
  return stage === 'ai_vision' || stage === 'ai_transcript';
}
