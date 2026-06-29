export interface FramePlanInput {
  durationSeconds: number;
  mode: 'balanced' | 'precision';
  fallbackIntervalSeconds: number;
}

export function planFrameTimestamps(input: FramePlanInput): number[] {
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds < 0) {
    return [];
  }

  const interval = input.mode === 'precision' ? 1 : input.fallbackIntervalSeconds;
  const safeInterval = Math.max(1, Math.floor(interval));
  const duration = Math.floor(input.durationSeconds);
  const timestamps: number[] = [];

  for (let second = 0; second <= duration; second += safeInterval) {
    timestamps.push(second);
  }

  if (timestamps[timestamps.length - 1] !== duration) {
    timestamps.push(duration);
  }

  return Array.from(new Set(timestamps));
}
