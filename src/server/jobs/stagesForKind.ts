import type { JobStage, MediaKind } from '../../shared/types';

export function stagesForKind(kind: MediaKind): JobStage[] {
  if (kind === 'video') return ['metadata', 'thumbnail', 'frames', 'audio', 'ai_vision', 'ai_transcript'];
  if (kind === 'image') return ['metadata', 'thumbnail', 'ai_vision'];
  return ['metadata'];
}
