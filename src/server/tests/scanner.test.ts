import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach } from 'vitest';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/connection';
import { createRepositories } from '../db/repositories';
import { classifyMediaFile } from '../scanner/fileTypes';
import { importSourceDirectory } from '../scanner/scanner';

let scannerTempDir: string | null = null;

afterEach(() => {
  if (scannerTempDir) {
    rmSync(scannerTempDir, { recursive: true, force: true });
    scannerTempDir = null;
  }
});

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

describe('importSourceDirectory', () => {
  it('indexes supported media files and ignores unsupported files', async () => {
    scannerTempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-scan-'));
    const sourceDir = path.join(scannerTempDir, 'factory');
    mkdirSync(sourceDir);
    writeFileSync(path.join(sourceDir, 'photo.jpg'), 'fake image');
    writeFileSync(path.join(sourceDir, 'cut.mp4'), 'fake video');
    writeFileSync(path.join(sourceDir, 'notes.txt'), 'ignore me');

    const db = openDatabase(path.join(scannerTempDir, 'library.sqlite'));
    const repos = createRepositories(db);

    const result = await importSourceDirectory(repos, {
      rootPath: sourceDir,
      name: 'Factory'
    });

    expect(result.indexed).toBe(2);
    expect(result.skipped).toBe(1);
    expect(repos.assets.searchAssets({})).toHaveLength(2);
    expect(repos.jobs.summary().pending).toBeGreaterThan(0);
    db.close();
  });
});
