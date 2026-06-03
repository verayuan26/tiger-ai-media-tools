import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { lookup } from 'mime-types';
import type { AiProvider, ImageAnalysisResult, TranscriptResult, VisualTagResult } from './provider';

export interface GeminiProviderConfig {
  baseUrl: string;
  apiKey: string;
  visionModel: string;
  transcribeModel: string;
}

export interface GeminiTranscriptionConfig {
  baseUrl: string;
  apiKey: string;
  transcribeModel: string;
}

const DEFAULT_GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const MAX_INLINE_AUDIO_BYTES = 18 * 1024 * 1024;

const VISION_TAG_PROMPT =
  'Analyze this garment/media image. Return JSON only with shape {"tags":[{"displayName":string,"confidence":number}]} and no markdown. Every displayName MUST be in simplified Chinese (简体中文). Use concise Chinese tags for visible objects, scenes, and actions.';

const TRANSCRIBE_PROMPT =
  'Transcribe this audio accurately. Return JSON only with shape {"text":string,"language":string} where language is a short language code (e.g. zh, en). No markdown.';

const REQUIRED_CONFIG: Array<[keyof GeminiProviderConfig, string]> = [
  ['baseUrl', 'GEMINI base URL'],
  ['apiKey', 'GEMINI API key'],
  ['visionModel', 'GEMINI vision model'],
  ['transcribeModel', 'GEMINI transcribe model']
];

export function normalizeGeminiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (trimmed.length === 0) {
    return DEFAULT_GEMINI_BASE_URL;
  }

  if (/\/v1beta$/i.test(trimmed)) {
    return trimmed;
  }

  if (/\/v1$/i.test(trimmed)) {
    return trimmed.replace(/\/v1$/i, '/v1beta');
  }

  return `${trimmed}/v1beta`;
}

export async function pingGeminiProvider(config: GeminiProviderConfig): Promise<void> {
  validateConfig(config);
  const baseUrl = normalizeGeminiBaseUrl(config.baseUrl);
  const response = await fetch(`${baseUrl}/models`, {
    method: 'GET',
    headers: geminiHeaders(config.apiKey)
  });

  assertOkResponse(response, 'Gemini connectivity check failed');
}

export async function transcribeAudioWithGemini(
  config: GeminiTranscriptionConfig,
  input: { audioPath: string }
): Promise<TranscriptResult> {
  assertTranscriptionConfig(config);

  const audio = await readFile(input.audioPath);
  if (audio.byteLength > MAX_INLINE_AUDIO_BYTES) {
    throw new Error(
      `Audio file is too large for Gemini inline transcription (${audio.byteLength} bytes). Use a shorter clip or switch to another transcribe provider.`
    );
  }

  const mimeType = lookup(input.audioPath) || 'audio/wav';
  const body = await generateGeminiContent(config, config.transcribeModel, [
    {
      inline_data: {
        mime_type: mimeType,
        data: audio.toString('base64')
      }
    },
    { text: TRANSCRIBE_PROMPT }
  ]);

  const parsed = parseTranscriptionJson(body);
  return {
    segments: [
      {
        startSeconds: 0,
        endSeconds: 0,
        language: parsed.language,
        text: parsed.text,
        translation: null
      }
    ]
  };
}

export function createGeminiProvider(config: GeminiProviderConfig): AiProvider {
  validateConfig(config);
  const transcriptionConfig: GeminiTranscriptionConfig = {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    transcribeModel: config.transcribeModel
  };

  return {
    async analyzeImage({ imagePath }) {
      const image = await readFile(imagePath);
      const mimeType = lookup(imagePath) || 'application/octet-stream';
      const content = await generateGeminiContent(config, config.visionModel, [
        { text: VISION_TAG_PROMPT },
        {
          inline_data: {
            mime_type: mimeType,
            data: image.toString('base64')
          }
        }
      ]);

      return parseImageAnalysisResult(content);
    },

    async transcribeAudio(input) {
      return transcribeAudioWithGemini(transcriptionConfig, input);
    }
  };
}

async function generateGeminiContent(
  config: GeminiTranscriptionConfig,
  model: string,
  parts: GeminiPart[]
): Promise<string> {
  const baseUrl = normalizeGeminiBaseUrl(config.baseUrl);
  const modelId = normalizeGeminiModelId(model);
  const response = await fetch(`${baseUrl}/models/${modelId}:generateContent`, {
    method: 'POST',
    headers: {
      ...geminiHeaders(config.apiKey),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  await assertOkResponseWithBody(response, 'Gemini generateContent request failed');
  const body = (await response.json()) as GeminiGenerateContentResponse;
  const text = extractTextFromGeminiResponse(body);
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  return text;
}

function geminiHeaders(apiKey: string): Record<string, string> {
  return {
    'x-goog-api-key': apiKey
  };
}

function normalizeGeminiModelId(model: string): string {
  const trimmed = model.trim();
  if (trimmed.startsWith('models/')) {
    return trimmed.slice('models/'.length);
  }

  return trimmed;
}

function extractTextFromGeminiResponse(body: GeminiGenerateContentResponse): string {
  const parts = body.candidates?.[0]?.content?.parts;
  if (!parts?.length) {
    return '';
  }

  return parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();
}

function parseImageAnalysisResult(content: string): ImageAnalysisResult {
  const parsed = JSON.parse(content) as Partial<ImageAnalysisResult>;
  const tags = Array.isArray(parsed.tags) ? parsed.tags.filter(isVisualTagResult) : [];
  return { tags };
}

function parseTranscriptionJson(content: string): { text: string; language: string } {
  const parsed = JSON.parse(content) as { text?: string; language?: string };
  return {
    text: typeof parsed.text === 'string' ? parsed.text : '',
    language:
      typeof parsed.language === 'string' && parsed.language.length > 0 ? parsed.language : 'unknown'
  };
}

function isVisualTagResult(value: unknown): value is VisualTagResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const tag = value as Partial<VisualTagResult>;
  return typeof tag.displayName === 'string' && typeof tag.confidence === 'number';
}

function assertOkResponse(response: Response, message: string): void {
  if (!response.ok) {
    throw new Error(`${message} with HTTP status ${response.status}.`);
  }
}

async function assertOkResponseWithBody(response: Response, message: string): Promise<void> {
  if (response.ok) return;

  let detail = '';
  try {
    const body = (await response.json()) as { error?: { message?: string; status?: string } };
    const apiMsg = body?.error?.message;
    const apiStatus = body?.error?.status;
    if (apiMsg) {
      detail = ` — ${apiStatus ? `[${apiStatus}] ` : ''}${apiMsg}`;
    }
  } catch {
    try {
      const text = await response.text();
      if (text) detail = ` — ${text.slice(0, 200)}`;
    } catch {
      // ignore
    }
  }

  throw new Error(`${message} with HTTP status ${response.status}${detail}.`);
}

function assertTranscriptionConfig(config: GeminiTranscriptionConfig): void {
  if (!config.baseUrl.trim()) {
    throw new Error('Gemini base URL is required.');
  }
  if (!config.apiKey.trim()) {
    throw new Error('Gemini API key is required.');
  }
  if (!config.transcribeModel.trim()) {
    throw new Error('Gemini transcribe model is required.');
  }
}

function validateConfig(config: GeminiProviderConfig): void {
  for (const [key, label] of REQUIRED_CONFIG) {
    if (config[key].trim().length === 0) {
      throw new Error(`${label} is required to create the Gemini AI provider.`);
    }
  }
}

type GeminiPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}
