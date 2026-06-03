import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { aiFetch } from './httpClient';
import type { TranscriptResult } from './provider';
import {
  isNoValidSpeechFragment,
  TranscriptionNoSpeechError
} from './transcriptionErrors';

export interface DashScopeAsrConfig {
  apiBaseUrl: string;
  apiKey: string;
  transcribeModel: string;
  proxyUrl?: string;
}

const DEFAULT_API_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1';
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 900;

/** 纠正设置页常见误填（compatible-mode、完整转写路径等），统一为 DashScope API 根地址。 */
export function normalizeDashScopeApiBaseUrl(baseUrl: string): string {
  let trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (trimmed.length === 0) {
    return DEFAULT_API_BASE_URL;
  }

  trimmed = trimmed.replace(/\/compatible-mode\/v1$/i, '/api/v1');
  trimmed = trimmed.replace(/\/services\/audio\/asr\/transcription$/i, '');
  trimmed = trimmed.replace(/\/tasks(?:\/.*)?$/i, '');
  trimmed = trimmed.replace(/\/+$/, '');

  const dashScopeOrigin = trimmed.match(/^(https:\/\/dashscope(?:-intl)?\.aliyuncs\.com)/i);
  if (dashScopeOrigin && !/\/api\/v1$/i.test(trimmed)) {
    return `${dashScopeOrigin[1]}/api/v1`;
  }

  if (/^https:\/\/dashscope(?:-intl)?\.aliyuncs\.com$/i.test(trimmed)) {
    return `${trimmed}/api/v1`;
  }

  return trimmed;
}

export function dashScopeUploadsUrl(apiBaseUrl: string): string {
  return `${normalizeDashScopeApiBaseUrl(apiBaseUrl)}/uploads`;
}

export function dashScopeTranscriptionSubmitUrl(apiBaseUrl: string): string {
  return `${normalizeDashScopeApiBaseUrl(apiBaseUrl)}/services/audio/asr/transcription`;
}

export function dashScopeTaskUrl(apiBaseUrl: string, taskId: string): string {
  return `${normalizeDashScopeApiBaseUrl(apiBaseUrl)}/tasks/${taskId}`;
}

/** 百炼 DashScope 异步录音文件识别（fun-asr / paraformer / qwen3-asr-flash-filetrans 等） */
export async function transcribeAudioWithDashScopeAsr(
  config: DashScopeAsrConfig,
  input: { audioPath: string }
): Promise<TranscriptResult> {
  assertConfig(config);

  const apiBaseUrl = normalizeDashScopeApiBaseUrl(config.apiBaseUrl);
  const fileUrl = await uploadLocalAudio(
    config.apiKey,
    config.transcribeModel,
    input.audioPath,
    apiBaseUrl,
    config.proxyUrl
  );
  const taskId = await submitTranscriptionTask(apiBaseUrl, config, fileUrl);
  try {
    const transcriptionUrl = await pollTranscriptionTask(
      apiBaseUrl,
      config.apiKey,
      taskId,
      config.proxyUrl
    );
    const transcriptionJson = await fetchJson(transcriptionUrl, config.proxyUrl);
    return parseDashScopeTranscription(transcriptionJson);
  } catch (error) {
    if (error instanceof TranscriptionNoSpeechError) {
      return { segments: [] };
    }
    throw error;
  }
}

function assertConfig(config: DashScopeAsrConfig): void {
  if (!config.apiKey.trim()) {
    throw new Error('百炼转写 API Key 未配置。请在设置页填写备选转写 API Key。');
  }
  if (!config.transcribeModel.trim()) {
    throw new Error('百炼转写模型未配置。');
  }
}

function buildTranscriptionInput(model: string, fileUrl: string): Record<string, string | string[]> {
  if (usesFileUrlsArray(model)) {
    return { file_urls: [fileUrl] };
  }

  return { file_url: fileUrl };
}

function usesFileUrlsArray(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return (
    normalized.startsWith('fun-asr') ||
    normalized.startsWith('paraformer') ||
    normalized.startsWith('sensevoice')
  );
}

async function uploadLocalAudio(
  apiKey: string,
  model: string,
  audioPath: string,
  apiBaseUrl: string,
  proxyUrl?: string
): Promise<string> {
  const uploadsUrl = dashScopeUploadsUrl(apiBaseUrl);
  const policyResponse = await aiFetch(
    `${uploadsUrl}?action=getPolicy&model=${encodeURIComponent(model)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    },
    proxyUrl
  );

  if (!policyResponse.ok) {
    throw new Error(
      `百炼文件上传凭证获取失败（HTTP ${policyResponse.status}）：${await readErrorBody(policyResponse)}`
    );
  }

  const policyBody = (await policyResponse.json()) as {
    data?: Record<string, string>;
  };
  const policy = policyBody.data;
  if (!policy?.upload_host || !policy.upload_dir) {
    throw new Error('百炼文件上传凭证响应格式异常。');
  }

  const fileName = path.basename(audioPath);
  const key = `${policy.upload_dir}/${fileName}`;
  const fileBuffer = await readFile(audioPath);
  const formData = new FormData();
  formData.set('OSSAccessKeyId', policy.oss_access_key_id ?? '');
  formData.set('Signature', policy.signature ?? '');
  formData.set('policy', policy.policy ?? '');
  formData.set('x-oss-object-acl', policy.x_oss_object_acl ?? '');
  formData.set('x-oss-forbid-overwrite', policy.x_oss_forbid_overwrite ?? '');
  formData.set('key', key);
  formData.set('success_action_status', '200');
  formData.set('file', new Blob([fileBuffer]), fileName);

  const uploadResponse = await aiFetch(
    policy.upload_host,
    {
      method: 'POST',
      body: formData
    },
    proxyUrl
  );

  if (!uploadResponse.ok) {
    throw new Error(
      `百炼临时文件上传失败（HTTP ${uploadResponse.status}）：${await readErrorBody(uploadResponse)}`
    );
  }

  return `oss://${key}`;
}

async function submitTranscriptionTask(
  apiBaseUrl: string,
  config: DashScopeAsrConfig,
  fileUrl: string
): Promise<string> {
  const submitUrl = dashScopeTranscriptionSubmitUrl(apiBaseUrl);
  const response = await aiFetch(
    submitUrl,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
        'X-DashScope-OssResourceResolve': 'enable'
      },
      body: JSON.stringify({
        model: config.transcribeModel,
        input: buildTranscriptionInput(config.transcribeModel, fileUrl),
        parameters: {
          channel_id: [0],
          enable_itn: false,
          enable_words: true
        }
      })
    },
    config.proxyUrl
  );

  if (!response.ok) {
    throw new Error(
      `百炼转写任务提交失败（HTTP ${response.status}，POST ${submitUrl}）：${await readErrorBody(response)}`
    );
  }

  const body = (await response.json()) as {
    output?: { task_id?: string };
  };
  const taskId = body.output?.task_id?.trim();
  if (!taskId) {
    throw new Error('百炼转写任务提交成功但未返回 task_id。');
  }

  return taskId;
}

async function pollTranscriptionTask(
  apiBaseUrl: string,
  apiKey: string,
  taskId: string,
  proxyUrl?: string
): Promise<string> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await sleep(POLL_INTERVAL_MS);
    }

    const queryUrl = dashScopeTaskUrl(apiBaseUrl, taskId);
    const response = await aiFetch(
      queryUrl,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'X-DashScope-Async': 'enable',
          'Content-Type': 'application/json'
        }
      },
      proxyUrl
    );

    if (!response.ok) {
      throw new Error(
        `百炼转写任务查询失败（HTTP ${response.status}）：${await readErrorBody(response)}`
      );
    }

    const body = (await response.json()) as {
      output?: DashScopeTaskOutput;
    };
    const outcome = resolveDashScopeTaskPollOutcome(body.output);

    if (outcome.type === 'success') {
      return outcome.transcriptionUrl;
    }

    if (outcome.type === 'no_speech') {
      throw new TranscriptionNoSpeechError(outcome.detail);
    }

    if (outcome.type === 'failure') {
      throw new Error(outcome.message);
    }
  }

  throw new Error('百炼转写任务超时，请稍后重试。');
}

type DashScopeTaskOutput = {
  task_status?: string;
  message?: string;
  code?: string;
  result?: { transcription_url?: string; message?: string; code?: string };
  results?: Array<{
    transcription_url?: string;
    subtask_status?: string;
    message?: string;
    code?: string;
  }>;
};

export type DashScopeTaskPollOutcome =
  | { type: 'pending' }
  | { type: 'success'; transcriptionUrl: string }
  | { type: 'no_speech'; detail: string }
  | { type: 'failure'; message: string };

export function resolveDashScopeTaskPollOutcome(
  output: DashScopeTaskOutput | undefined
): DashScopeTaskPollOutcome {
  const status = String(output?.task_status ?? '').toUpperCase();

  if (status === 'SUCCEEDED') {
    const transcriptionUrl = extractTranscriptionUrl(output);
    if (transcriptionUrl) {
      return { type: 'success', transcriptionUrl };
    }

    if (hasNoValidSpeechSignal(output)) {
      return { type: 'no_speech', detail: extractFailureDetail(output) || 'SUCCESS_WITH_NO_VALID_FRAGMENT' };
    }

    return { type: 'failure', message: '百炼转写任务成功但未返回 transcription_url。' };
  }

  if (status === 'FAILED' || status === 'UNKNOWN') {
    const detail = extractFailureDetail(output) || '未知错误';
    if (isNoValidSpeechFragment(detail)) {
      return { type: 'no_speech', detail };
    }

    return { type: 'failure', message: `百炼转写任务失败（${status}）：${detail}` };
  }

  return { type: 'pending' };
}

function extractFailureDetail(output: DashScopeTaskOutput | undefined): string {
  const parts = [
    output?.message,
    output?.code,
    output?.result?.message,
    output?.result?.code
  ];

  for (const item of output?.results ?? []) {
    parts.push(item.message, item.code, item.subtask_status);
  }

  return parts
    .map((value) => String(value ?? '').trim())
    .filter((value) => value.length > 0)
    .join(' ');
}

function hasNoValidSpeechSignal(output: DashScopeTaskOutput | undefined): boolean {
  if (isNoValidSpeechFragment(extractFailureDetail(output))) {
    return true;
  }

  const results = output?.results ?? [];
  if (results.length === 0) {
    return false;
  }

  return results.every((item) => {
    const detail = [item.subtask_status, item.message, item.code]
      .map((value) => String(value ?? '').trim())
      .filter((value) => value.length > 0)
      .join(' ');

    return isNoValidSpeechFragment(detail);
  });
}

function extractTranscriptionUrl(
  output:
    | {
        result?: { transcription_url?: string };
        results?: Array<{ transcription_url?: string }>;
      }
    | undefined
): string | null {
  const single = output?.result?.transcription_url?.trim();
  if (single) {
    return single;
  }

  for (const item of output?.results ?? []) {
    const url = item.transcription_url?.trim();
    if (url) {
      return url;
    }
  }

  return null;
}

async function fetchJson(url: string, proxyUrl?: string): Promise<unknown> {
  const response = await aiFetch(url, {}, proxyUrl);
  if (!response.ok) {
    throw new Error(`百炼转写结果下载失败（HTTP ${response.status}）。`);
  }

  return response.json();
}

export function parseDashScopeTranscription(body: unknown): TranscriptResult {
  const root = body as {
    transcripts?: Array<{
      text?: string;
      sentences?: Array<{
        begin_time?: number;
        end_time?: number;
        text?: string;
      }>;
    }>;
  };

  const segments: TranscriptResult['segments'] = [];
  for (const transcript of root.transcripts ?? []) {
    if (Array.isArray(transcript.sentences) && transcript.sentences.length > 0) {
      for (const sentence of transcript.sentences) {
        const text = String(sentence.text ?? '').trim();
        if (!text) continue;

        segments.push({
          startSeconds: Number(sentence.begin_time ?? 0) / 1000,
          endSeconds: Number(sentence.end_time ?? 0) / 1000,
          language: 'zh',
          text,
          translation: null
        });
      }
      continue;
    }

    const text = String(transcript.text ?? '').trim();
    if (text) {
      segments.push({
        startSeconds: 0,
        endSeconds: 0,
        language: 'zh',
        text,
        translation: null
      });
    }
  }

  return { segments };
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return response.statusText;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
