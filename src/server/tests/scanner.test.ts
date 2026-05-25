import { describe, expect, it } from 'vitest';
import { classifyMediaFile } from '../scanner/fileTypes';

describe('classifyMediaFile', () => {
  it('classifies supported image, video, and audio extensions', () => {
    expect(classifyMediaFile('/media/photo.JPG')).toEqual({ kind: 'image', extension: '.jpg' });
    expect(classifyMediaFile('/media/factory_cutting_01.mp4')).toEqual({ kind: 'video', extension: '.mp4' });
    expect(classifyMediaFile('/media/music.WAV')).toEqual({ kind: 'audio', extension: '.wav' });
  });

  it('returns null for unsupported files', () => {
    expect(classifyMediaFile('/media/readme.txt')).toBeNull();
    expect(classifyMediaFile('/media/archive.zip')).toBeNull();
  });
});
