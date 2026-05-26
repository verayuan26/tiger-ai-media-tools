import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import { planFrameTimestamps } from './framePlan';

export interface MediaMetadata {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
}

export interface ExtractedFrame {
  timestampSeconds: number;
  thumbnailPath: string;
}

/** Minimum output width when downscaling extracted frames. */
export const MIN_FRAME_WIDTH = 720;

/** Maximum output width before downscaling very large sources. */
export const MAX_FRAME_WIDTH = 1920;

/** JPEG quality for extracted frames (`-q:v 2` ≈ high quality). */
export const FRAME_JPEG_QUALITY = '2';

export function buildFrameScaleFilter(sourceWidth: number | null | undefined): string | null {
  if (!sourceWidth || sourceWidth <= 0 || sourceWidth <= MAX_FRAME_WIDTH) {
    return null;
  }

  const targetWidth = Math.max(MIN_FRAME_WIDTH, MAX_FRAME_WIDTH);
  return `scale=${targetWidth}:-2`;
}

export function buildFfmpegFrameArgs(input: {
  timestampSeconds: number;
  filePath: string;
  outputPath: string;
  sourceWidth?: number | null;
}): string[] {
  const args = [
    '-y',
    '-ss',
    String(input.timestampSeconds),
    '-i',
    input.filePath,
    '-frames:v',
    '1'
  ];

  const scaleFilter = buildFrameScaleFilter(input.sourceWidth);
  if (scaleFilter) {
    args.push('-vf', scaleFilter);
  }

  args.push('-q:v', FRAME_JPEG_QUALITY, input.outputPath);
  return args;
}

export function parseFfprobeDuration(duration: string | undefined): number | null {
  if (!duration) {
    return null;
  }

  const parsedDuration = Number(duration);
  return Number.isFinite(parsedDuration) ? parsedDuration : null;
}

export function safeFrameFileStem(assetId: string): string {
  const normalized = assetId
    .replace(/[\\/]+/g, '-')
    .replace(/\.\./g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '');

  return normalized || 'asset';
}

export async function probeMedia(filePath: string): Promise<MediaMetadata> {
  const { stdout } = await execa('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration:stream=width,height',
    '-of',
    'json',
    filePath
  ]);
  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{ width?: number; height?: number }>;
  };
  const videoStream = parsed.streams?.find((stream) => stream.width && stream.height);
  return {
    durationSeconds: parseFfprobeDuration(parsed.format?.duration),
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null
  };
}

export async function extractVideoFrames(input: {
  filePath: string;
  assetId: string;
  durationSeconds: number;
  outputDir: string;
  mode: 'balanced' | 'precision';
  sourceWidth?: number | null;
}): Promise<ExtractedFrame[]> {
  await mkdir(input.outputDir, { recursive: true });
  const timestamps = planFrameTimestamps({
    durationSeconds: input.durationSeconds,
    mode: input.mode,
    fallbackIntervalSeconds: 3
  });

  const frames: ExtractedFrame[] = [];
  const fileStem = safeFrameFileStem(input.assetId);
  for (const timestamp of timestamps) {
    const outputPath = path.join(input.outputDir, `${fileStem}-${timestamp}.jpg`);
    await execa(
      'ffmpeg',
      buildFfmpegFrameArgs({
        timestampSeconds: timestamp,
        filePath: input.filePath,
        outputPath,
        sourceWidth: input.sourceWidth
      })
    );
    frames.push({ timestampSeconds: timestamp, thumbnailPath: outputPath });
  }

  return frames;
}
