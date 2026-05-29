import { describe, expect, it } from 'vitest';
import { defaultSourceNameFromPath } from './pick-directory';

describe('defaultSourceNameFromPath', () => {
  it('uses the final path segment as the default source name', () => {
    expect(defaultSourceNameFromPath('/Users/example/Documents/factory-media/')).toBe('factory-media');
    expect(defaultSourceNameFromPath('D:\\media\\clips')).toBe('clips');
  });

  it('falls back when the path has no segment', () => {
    expect(defaultSourceNameFromPath('/')).toBe('新素材库');
  });
});
