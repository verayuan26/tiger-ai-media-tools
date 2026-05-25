import path from 'node:path';
import {
  SUPPORTED_AUDIO_EXTENSIONS,
  SUPPORTED_IMAGE_EXTENSIONS,
  SUPPORTED_VIDEO_EXTENSIONS
} from '../../shared/constants';
import type { MediaKind } from '../../shared/types';

export interface ClassifiedMediaFile {
  kind: MediaKind;
  extension: string;
}

export function classifyMediaFile(filePath: string): ClassifiedMediaFile | null {
  const extension = path.extname(filePath).toLowerCase();

  if ((SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(extension)) {
    return { kind: 'image', extension };
  }

  if ((SUPPORTED_VIDEO_EXTENSIONS as readonly string[]).includes(extension)) {
    return { kind: 'video', extension };
  }

  if ((SUPPORTED_AUDIO_EXTENSIONS as readonly string[]).includes(extension)) {
    return { kind: 'audio', extension };
  }

  return null;
}
