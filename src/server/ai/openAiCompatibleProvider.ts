import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { lookup } from 'mime-types';
import type { AiProvider, ImageAnalysisResult, TranscriptResult, VisualTagResult } from './provider';

export interface OpenAiCompatibleProviderConfig {
  baseUrl: string;
  apiKey: string;
  visionModel: string;
  transcribeModel: string;
}

const REQUIRED_CONFIG: Array<[keyof OpenAiCompatibleProviderConfig, string]> = [
  ['baseUrl', 'AI_OPENAI_BASE_URL'],
  ['apiKey', 'AI_OPENAI_API_KEY'],
  ['visionModel', 'AI_OPENAI_VISION_MODEL'],
  ['transcribeModel', 'AI_OPENAI_TRANSCRIBE_MODEL']
];

export function createOpenAiCompatibleProvider(config: OpenAiCompatibleProviderConfig): AiProvider {
  validateConfig(config);
  const baseUrl = config.baseUrl.replace(/\/+$/, '');

  return {
    async analyzeImage({ imagePath }) {
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
                  text: 'Analyze this garment/media image. Return JSON only with shape {"tags":[{"displayName":string,"confidence":number}]} and no markdown.'
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

    async transcribeAudio({ audioPath }) {
      const audio = await readFile(audioPath);
      const fileName = path.basename(audioPath);
      const mimeType = lookup(audioPath) || 'application/octet-stream';
      const formData = new FormData();
      formData.set('model', config.transcribeModel);
      formData.set('file', new Blob([audio], { type: mimeType }), fileName);

      const response = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`
        },
        body: formData
      });

      assertOkResponse(response, 'OpenAI-compatible audio transcription request failed');
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
  };
}

function assertOkResponse(response: Response, message: string): void {
  if (!response.ok) {
    throw new Error(`${message} with HTTP status ${response.status}.`);
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
