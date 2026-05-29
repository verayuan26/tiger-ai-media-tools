import path from 'node:path';
import type { AiProvider } from '../ai/provider';
import type { createRepositories } from '../db/repositories';
import {
  extractAudioTrack,
  extractVideoFrames,
  ensureTranscriptionAudioFile,
  probeMedia,
  transcriptionAudioPath
} from '../media/ffmpeg';
import { isTranscriptionNoSpeechError } from '../ai/transcriptionErrors';
import type { AnalysisJob, JobStage } from '../../shared/types';
import type { DrainBlockedInfo } from '../../shared/settings';

export interface AnalysisContext {
  repos: ReturnType<typeof createRepositories>;
  aiProvider: AiProvider;
  dataDir: string;
  frameMode: 'balanced' | 'precision';
  checkDrainLimits?: (processingCount: number) => DrainBlockedInfo | null;
  checkJobBudget?: (job: AnalysisJob) => DrainBlockedInfo | null;
  onAiJobCompleted?: (job: AnalysisJob) => void;
}

export interface AnalysisJobResult {
  status: 'done' | 'skipped';
}

export async function processAnalysisJob(
  job: AnalysisJob,
  context: AnalysisContext
): Promise<AnalysisJobResult> {
  const asset = context.repos.assets.getById(job.assetId);
  if (!asset) {
    throw new Error(`Asset not found for analysis job: ${job.assetId}`);
  }

  switch (job.stage) {
    case 'metadata': {
      if (asset.kind === 'video' || asset.kind === 'audio') {
        const metadata = await probeMedia(asset.path);
        context.repos.assets.setMetadata(asset.id, {
          durationSeconds: metadata.durationSeconds,
          width: metadata.width,
          height: metadata.height,
          status: 'partial'
        });
      } else {
        context.repos.assets.setMetadata(asset.id, { status: 'partial' });
      }
      return { status: 'done' };
    }

    case 'frames': {
      if (asset.kind !== 'video') {
        return { status: 'skipped' };
      }

      const frameMode = asset.frameMode === 'precision' ? 'precision' : context.frameMode;
      const frames = await extractVideoFrames({
        filePath: asset.path,
        assetId: asset.id,
        durationSeconds: asset.durationSeconds ?? 0,
        outputDir: path.join(context.dataDir, 'frames', asset.id),
        mode: frameMode,
        sourceWidth: asset.width
      });
      const strategy = frameMode === 'precision' ? 'precision' : 'interval';
      context.repos.frames.replaceFrames(
        asset.id,
        frames.map((frame) => ({
          timestampSeconds: frame.timestampSeconds,
          thumbnailPath: frame.thumbnailPath,
          strategy
        }))
      );
      context.repos.assets.setMetadata(asset.id, {
        thumbnailPath: frames[0]?.thumbnailPath,
        status: 'partial'
      });
      return { status: 'done' };
    }

    case 'thumbnail': {
      context.repos.assets.setMetadata(asset.id, {
        thumbnailPath: asset.thumbnailPath ?? asset.path,
        status: 'partial'
      });
      return { status: 'done' };
    }

    case 'audio': {
      if (asset.kind === 'video') {
        await extractAudioTrack({
          filePath: asset.path,
          outputPath: transcriptionAudioPath(context.dataDir, asset.id)
        });
      }

      context.repos.assets.setMetadata(asset.id, { status: 'partial' });
      return { status: 'done' };
    }

    case 'ai_vision': {
      const result = await context.aiProvider.analyzeImage({
        imagePath: asset.thumbnailPath ?? asset.path
      });
      context.repos.tags.replaceAiAssetTags(asset.id, result.tags);

      if (asset.kind === 'video') {
        const frames = context.repos.frames.listForAsset(asset.id);
        for (const frame of frames) {
          const frameResult = await context.aiProvider.analyzeImage({
            imagePath: frame.thumbnailPath
          });
          context.repos.tags.replaceAiFrameTags(frame.id, frameResult.tags);
        }
      }

      context.repos.assets.setMetadata(asset.id, { status: 'partial' });
      return { status: 'done' };
    }

    case 'ai_transcript': {
      if (asset.kind === 'image') {
        return { status: 'skipped' };
      }

      const audioPath = await ensureTranscriptionAudioFile({
        asset,
        dataDir: context.dataDir
      });

      try {
        const result = await context.aiProvider.transcribeAudio({ audioPath });
        context.repos.transcripts.replaceSegments(asset.id, result.segments);
      } catch (error) {
        if (isTranscriptionNoSpeechError(error)) {
          context.repos.transcripts.replaceSegments(asset.id, []);
        } else {
          throw error;
        }
      }

      context.repos.assets.setMetadata(asset.id, { status: 'partial' });
      return { status: 'done' };
    }

    default:
      return assertUnsupportedStage(job.stage);
  }
}

function assertUnsupportedStage(stage: never): never {
  throw new Error(`Unsupported analysis job stage: ${stage as JobStage}`);
}
