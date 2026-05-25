export const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.tif', '.tiff'] as const;
export const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm'] as const;
export const SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'] as const;

export const JOB_STATUSES = ['pending', 'processing', 'partial', 'done', 'failed', 'skipped'] as const;
export const JOB_STAGES = ['metadata', 'thumbnail', 'frames', 'audio', 'ai_vision', 'ai_transcript'] as const;
