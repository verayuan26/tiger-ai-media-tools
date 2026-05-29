export class TranscriptionUnsupportedError extends Error {
  constructor(
    public readonly status: number,
    public readonly endpoint: string
  ) {
    super(
      `Remote transcription endpoint is unavailable (HTTP ${status} for ${endpoint}). The configured API may not support /audio/transcriptions.`
    );
    this.name = 'TranscriptionUnsupportedError';
  }
}

export function isTranscriptionUnsupportedError(error: unknown): error is TranscriptionUnsupportedError {
  return error instanceof TranscriptionUnsupportedError;
}

/** 音频中未检测到可识别语音（静音、纯 BGM 等），应视为转写成功且结果为空。 */
export class TranscriptionNoSpeechError extends Error {
  constructor(public readonly detail: string) {
    super(`No valid speech fragment detected: ${detail}`);
    this.name = 'TranscriptionNoSpeechError';
  }
}

export function isTranscriptionNoSpeechError(error: unknown): error is TranscriptionNoSpeechError {
  return error instanceof TranscriptionNoSpeechError;
}

export function isNoValidSpeechFragment(detail: string): boolean {
  return /SUCCESS_WITH_NO_VALID_FRAGMENT/i.test(detail);
}
