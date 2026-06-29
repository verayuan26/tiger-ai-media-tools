import { describe, expect, it } from 'vitest';
import { planFrameTimestamps } from './framePlan';

describe('planFrameTimestamps', () => {
  it('uses one-second sampling in precision mode', () => {
    expect(
      planFrameTimestamps({
        durationSeconds: 4,
        mode: 'precision',
        fallbackIntervalSeconds: 3
      })
    ).toEqual([0, 1, 2, 3, 4]);
  });

  it('keeps the configured interval in balanced mode', () => {
    expect(
      planFrameTimestamps({
        durationSeconds: 7,
        mode: 'balanced',
        fallbackIntervalSeconds: 3
      })
    ).toEqual([0, 3, 6, 7]);
  });
});
