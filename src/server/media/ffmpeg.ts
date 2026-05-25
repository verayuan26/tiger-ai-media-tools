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
    await execa('ffmpeg', [
      '-y',
      '-ss',
      String(timestamp),
      '-i',
      input.filePath,
      '-frames:v',
      '1',
      '-vf',
      'scale=480:-1',
      outputPath
    ]);
    frames.push({ timestampSeconds: timestamp, thumbnailPath: outputPath });
  }

  return frames;
}
