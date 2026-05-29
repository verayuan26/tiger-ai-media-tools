import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { lookup } from 'mime-types';
import type { AiProvider, ImageAnalysisResult, TranscriptResult, VisualTagResult } from './provider';
import { TranscriptionUnsupportedError } from './transcriptionErrors';

export interface OpenAiCompatibleProviderConfig {
  baseUrl: string;
  apiKey: string;
  visionModel: string;
  transcribeModel: string;
}

export interface OpenAiTranscriptionConfig {
  baseUrl: string;
  apiKey: string;
  transcribeModel: string;
}

const REQUIRED_CONFIG: Array<[keyof OpenAiCompatibleProviderConfig, string]> = [
  ['baseUrl', 'AI_OPENAI_BASE_URL'],
  ['apiKey', 'AI_OPENAI_API_KEY'],
  ['visionModel', 'AI_OPENAI_VISION_MODEL'],
  ['transcribeModel', 'AI_OPENAI_TRANSCRIBE_MODEL']
];

const VISION_TAG_PROMPT =
  'Analyze this garment/media image. Return JSON only with shape {"tags":[{"displayName":string,"confidence":number}]} and no markdown. Every displayName MUST be in simplified Chinese (简体中文). Use concise Chinese tags for visible objects, scenes, and actions.';

/** Ensures OpenAI-compatible routes resolve under `/v1` (e.g. `/v1/audio/transcriptions`). */
export function normalizeOpenAiCompatibleBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (trimmed.length === 0) {
    return trimmed;
  }

  return /\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

export async function pingOpenAiCompatibleProvider(config: OpenAiCompatibleProviderConfig): Promise<void> {
  validateConfig(config);
  const baseUrl = normalizeOpenAiCompatibleBaseUrl(config.baseUrl);
  const response = await fetch(`${baseUrl}/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.apiKey}`
    }
  });

  assertOkResponse(response, 'OpenAI-compatible connectivity check failed');
}

export async function transcribeAudioWithOpenAiCompatible(
  config: OpenAiTranscriptionConfig,
  input: { audioPath: string }
): Promise<TranscriptResult> {
  assertTranscriptionConfig(config);

  const baseUrl = normalizeOpenAiCompatibleBaseUrl(config.baseUrl);
  const audio = await readFile(input.audioPath);
  const fileName = path.basename(input.audioPath);
  const mimeType = lookup(input.audioPath) || 'application/octet-stream';
  const formData = new FormData();
  formData.set('model', config.transcribeModel);
  formData.set('file', new Blob([audio], { type: mimeType }), fileName);

  const transcriptionUrl = `${baseUrl}/audio/transcriptions`;
  const response = await fetch(transcriptionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`
    },
    body: formData
  });

  assertTranscriptionResponse(response, transcriptionUrl);
  const body = (await response.json()) as TranscriptionResponse;
  return {
    segments: [
      {
        startSeconds: 0,
        endSeconds: 0,
        language: typeof body.language === 'string' && body.language.length > 0 ? body.language : 'unknown',
        text: typeof body.text === 'string' ? body.text : '',
        translation: null
      }
    ]
  };
}

export function createOpenAiCompatibleProvider(config: OpenAiCompatibleProviderConfig): AiProvider {
  validateConfig(config);
  const transcriptionConfig: OpenAiTranscriptionConfig = {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    transcribeModel: config.transcribeModel
  };

  return {
    async analyzeImage({ imagePath }) {
      const baseUrl = normalizeOpenAiCompatibleBaseUrl(config.baseUrl);
      const image = await readFile(imagePath);
      const mimeType = lookup(imagePath) || 'application/octet-stream';
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.visionModel,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: VISION_TAG_PROMPT
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${image.toString('base64')}`
                  }
                }
              ]
            }
          ]
        })
      });

      assertOkResponse(response, 'OpenAI-compatible image analysis request failed');
      const body = (await response.json()) as ChatCompletionResponse;
      const content = body.choices?.[0]?.message?.content;
      if (!content) {
        return { tags: [] };
      }

      return parseImageAnalysisResult(content);
    },

    async transcribeAudio(input) {
      return transcribeAudioWithOpenAiCompatible(transcriptionConfig, input);
    }
  };
}

function assertOkResponse(response: Response, message: string): void {
  if (!response.ok) {
    throw new Error(`${message} with HTTP status ${response.status}.`);
  }
}

function assertTranscriptionResponse(response: Response, endpoint: string): void {
  if (response.ok) {
    return;
  }

  if (response.status === 404 || response.status === 405 || response.status === 501) {
    throw new TranscriptionUnsupportedError(response.status, endpoint);
  }

  throw new Error(
    `OpenAI-compatible audio transcription request failed (POST ${endpoint}) with HTTP status ${response.status}.`
  );
}

function assertTranscriptionConfig(config: OpenAiTranscriptionConfig): void {
  if (!config.baseUrl.trim()) {
    throw new Error('Fallback transcription base URL is required.');
  }
  if (!config.apiKey.trim()) {
    throw new Error('Fallback transcription API key is required.');
  }
  if (!config.transcribeModel.trim()) {
    throw new Error('Fallback transcription model is required.');
  }
}

function validateConfig(config: OpenAiCompatibleProviderConfig): void {
  for (const [key, envName] of REQUIRED_CONFIG) {
    if (config[key].trim().length === 0) {
      throw new Error(`${envName} is required to create the OpenAI-compatible AI provider.`);
    }
  }
}

function parseImageAnalysisResult(content: string): ImageAnalysisResult {
  const parsed = JSON.parse(content) as Partial<ImageAnalysisResult>;
  const tags = Array.isArray(parsed.tags) ? parsed.tags.filter(isVisualTagResult) : [];

  return { tags };
}

function isVisualTagResult(value: unknown): value is VisualTagResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const tag = value as Partial<VisualTagResult>;
  return typeof tag.displayName === 'string' && typeof tag.confidence === 'number';
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

interface TranscriptionResponse {
  text?: string;
  language?: string;
}
