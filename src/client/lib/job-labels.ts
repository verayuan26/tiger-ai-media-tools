import type { JobStage, JobStatus, MediaKind } from '../../shared/types';
import { JOB_STAGES } from '../../shared/constants';

export const stageLabels: Record<JobStage, string> = {
  metadata: '读取元数据',
  thumbnail: '生成缩略图',
  frames: '视频抽帧',
  audio: '语音识别',
  ai_vision: 'AI 视觉识别',
  ai_transcript: '语音转写'
};

export const statusLabels: Record<JobStatus, string> = {
  pending: '等待中',
  processing: '处理中',
  partial: '部分完成',
  done: '已完成',
  failed: '失败',
  skipped: '跳过'
};

export const mediaKindLabels: Record<MediaKind, string> = {
  image: '图片',
  video: '视频',
  audio: '音频'
};

export function stageProgress(stage: JobStage): number {
  const index = JOB_STAGES.indexOf(stage);
  if (index < 0) return 0;
  return Math.round(((index + 1) / JOB_STAGES.length) * 100);
}
