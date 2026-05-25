import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach } from 'vitest';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/connection';
import { createRepositories } from '../db/repositories';
import { classifyMediaFile } from '../scanner/fileTypes';
import { importSourceDirectory } from '../scanner/scanner';

let scannerTempDir: string | null = null;
const sortStages = (stages: string[]) => [...stages].sort();
type ScannerDatabase = ReturnType<typeof openDatabase>;
type ScannerRepositories = ReturnType<typeof createRepositories>;

async function withScannerDatabase<T>(
  run: (repos: ScannerRepositories, db: ScannerDatabase) => Promise<T> | T
): Promise<T> {
  if (!scannerTempDir) throw new Error('scannerTempDir must be initialized');
  const db = openDatabase(path.join(scannerTempDir, 'library.sqlite'));
  const repos = createRepositories(db);

  try {
    return await run(repos, db);
  } finally {
    db.close();
  }
}

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

    await withScannerDatabase(async (repos) => {
      const result = await importSourceDirectory(repos, {
        rootPath: sourceDir,
        name: 'Factory'
      });

      expect(result.indexed).toBe(2);
      expect(result.skipped).toBe(1);
      expect(repos.assets.searchAssets({})).toHaveLength(2);
      expect(repos.jobs.summary().pending).toBeGreaterThan(0);
    });
  });

  it('walks nested directories, creates expected stage sets, and marks the source scanned', async () => {
    scannerTempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-scan-'));
    const sourceDir = path.join(scannerTempDir, 'factory');
    const nestedDir = path.join(sourceDir, 'line-a', 'shift-1');
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(path.join(sourceDir, 'photo.jpg'), 'fake image');
    writeFileSync(path.join(nestedDir, 'cut.mp4'), 'fake video');
    writeFileSync(path.join(nestedDir, 'audio.wav'), 'fake audio');

    await withScannerDatabase(async (repos) => {
      const result = await importSourceDirectory(repos, {
        rootPath: sourceDir,
        name: 'Factory'
      });

      const source = repos.sources.getById(result.sourceId);
      const assets = repos.assets.searchAssets({});
      const image = assets.find((asset) => asset.fileName === 'photo.jpg');
      const video = assets.find((asset) => asset.fileName === 'cut.mp4');
      const audio = assets.find((asset) => asset.fileName === 'audio.wav');

      expect(result.indexed).toBe(3);
      expect(source?.lastScannedAt).not.toBeNull();
      expect(image).toBeDefined();
      expect(video).toBeDefined();
      expect(audio).toBeDefined();
      expect(sortStages(repos.jobs.listForAsset(image?.id ?? '').map((job) => job.stage))).toEqual([
        'ai_vision',
        'metadata',
        'thumbnail'
      ]);
      expect(sortStages(repos.jobs.listForAsset(video?.id ?? '').map((job) => job.stage))).toEqual([
        'ai_transcript',
        'ai_vision',
        'audio',
        'frames',
        'metadata',
        'thumbnail'
      ]);
      expect(sortStages(repos.jobs.listForAsset(audio?.id ?? '').map((job) => job.stage))).toEqual(['metadata']);
    });
  });

  it('does not reset completed asset or job state when an unchanged file is re-imported', async () => {
    scannerTempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-scan-'));
    const sourceDir = path.join(scannerTempDir, 'factory');
    mkdirSync(sourceDir);
    writeFileSync(path.join(sourceDir, 'photo.jpg'), 'fake image');

    await withScannerDatabase(async (repos) => {
      await importSourceDirectory(repos, { rootPath: sourceDir, name: 'Factory' });
      const asset = repos.assets.searchAssets({})[0];
      repos.assets.setMetadata(asset.id, { status: 'done' });
      for (const job of repos.jobs.listForAsset(asset.id)) {
        repos.jobs.updateStatus(job.id, 'done');
      }

      await importSourceDirectory(repos, { rootPath: sourceDir, name: 'Factory' });

      expect(repos.assets.getById(asset.id)?.status).toBe('done');
      expect(repos.jobs.listForAsset(asset.id).map((job) => job.status)).toEqual(['done', 'done', 'done']);
      expect(repos.jobs.summary().pending).toBe(0);
    });
  });

  it('updates only modifiedAt when content is unchanged but file mtime changes', async () => {
    scannerTempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-scan-'));
    const sourceDir = path.join(scannerTempDir, 'factory');
    const filePath = path.join(sourceDir, 'photo.jpg');
    mkdirSync(sourceDir);
    writeFileSync(filePath, 'same image bytes');

    await withScannerDatabase(async (repos) => {
      await importSourceDirectory(repos, { rootPath: sourceDir, name: 'Factory' });
      const asset = repos.assets.searchAssets({})[0];
      repos.assets.setMetadata(asset.id, { status: 'done' });
      for (const job of repos.jobs.listForAsset(asset.id)) {
        repos.jobs.updateStatus(job.id, 'done');
      }

      const changedTime = new Date('2026-05-26T11:00:00.000Z');
      utimesSync(filePath, changedTime, changedTime);
      await importSourceDirectory(repos, { rootPath: sourceDir, name: 'Factory' });

      const updated = repos.assets.getById(asset.id);
      expect(updated?.status).toBe('done');
      expect(updated?.hash).toBe(asset.hash);
      expect(updated?.sizeBytes).toBe(asset.sizeBytes);
      expect(updated?.modifiedAt).toBe(changedTime.toISOString());
      expect(repos.jobs.listForAsset(asset.id).map((job) => job.status)).toEqual(['done', 'done', 'done']);
      expect(repos.jobs.summary().pending).toBe(0);
    });
  });

  it('updates a changed existing file and requeues its analysis jobs', async () => {
    scannerTempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-scan-'));
    const sourceDir = path.join(scannerTempDir, 'factory');
    const filePath = path.join(sourceDir, 'photo.jpg');
    mkdirSync(sourceDir);
    writeFileSync(filePath, 'fake image');

    await withScannerDatabase(async (repos) => {
      await importSourceDirectory(repos, { rootPath: sourceDir, name: 'Factory' });
      const asset = repos.assets.searchAssets({})[0];
      repos.assets.setMetadata(asset.id, { status: 'done' });
      for (const job of repos.jobs.listForAsset(asset.id)) {
        repos.jobs.updateStatus(job.id, 'done');
      }

      writeFileSync(filePath, 'fake image changed');
      const changedTime = new Date('2026-05-26T10:00:00.000Z');
      utimesSync(filePath, changedTime, changedTime);
      await importSourceDirectory(repos, { rootPath: sourceDir, name: 'Factory' });

      const updated = repos.assets.getById(asset.id);
      expect(updated?.status).toBe('pending');
      expect(updated?.hash).not.toBe(asset.hash);
      expect(repos.jobs.listForAsset(asset.id).map((job) => job.status)).toEqual(['pending', 'pending', 'pending']);
      expect(repos.jobs.summary().pending).toBe(3);
    });
  });

  it('clears stale derived data and generated tags when content changes', async () => {
    scannerTempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-scan-'));
    const sourceDir = path.join(scannerTempDir, 'factory');
    const filePath = path.join(sourceDir, 'cut.mp4');
    mkdirSync(sourceDir);
    writeFileSync(filePath, 'fake video');

    await withScannerDatabase(async (repos, db) => {
      await importSourceDirectory(repos, { rootPath: sourceDir, name: 'Factory' });
      const asset = repos.assets.searchAssets({})[0];
      repos.assets.setMetadata(asset.id, {
        durationSeconds: 10,
        width: 1920,
        height: 1080,
        thumbnailPath: '.data/thumbs/cut.jpg',
        status: 'done'
      });
      repos.frames.replaceFrames(asset.id, [
        { timestampSeconds: 3, thumbnailPath: '.data/thumbs/cut-3.jpg', strategy: 'interval' }
      ]);
      repos.transcripts.replaceSegments(asset.id, [
        { startSeconds: 1, endSeconds: 4, language: 'zh', text: 'old transcript', translation: null }
      ]);
      repos.tags.assignAssetTag(asset.id, 'Keep Manual', 'user', null);
      repos.tags.assignAssetTag(asset.id, 'Old AI Asset', 'ai', 0.9);
      const frame = repos.frames.listForAsset(asset.id)[0];
      const frameTagId = repos.tags.getOrCreate('Old AI Frame', 'ai');
      db.prepare(
        `insert into asset_tags (id, target_type, target_id, tag_id, confidence)
         values (?, 'frame', ?, ?, ?)`
      ).run('frame-ai-tag', frame.id, frameTagId, 0.8);
      for (const job of repos.jobs.listForAsset(asset.id)) {
        repos.jobs.updateStatus(job.id, 'done');
      }

      writeFileSync(filePath, 'fake video changed');
      const changedTime = new Date('2026-05-26T12:00:00.000Z');
      utimesSync(filePath, changedTime, changedTime);
      await importSourceDirectory(repos, { rootPath: sourceDir, name: 'Factory' });

      const updated = repos.assets.getById(asset.id);
      expect(updated).toMatchObject({
        status: 'pending',
        durationSeconds: null,
        width: null,
        height: null,
        thumbnailPath: null
      });
      expect(repos.frames.listForAsset(asset.id)).toEqual([]);
      expect(repos.transcripts.listForAsset(asset.id)).toEqual([]);
      expect(repos.jobs.listForAsset(asset.id).map((job) => job.status)).toEqual([
        'pending',
        'pending',
        'pending',
        'pending',
        'pending',
        'pending'
      ]);
      expect(repos.assets.searchAssets({ tagNames: ['Keep Manual'] })).toHaveLength(1);
      expect(repos.assets.searchAssets({ tagNames: ['Old AI Asset'] })).toHaveLength(0);
      expect(db.prepare('select count(*) as count from asset_tags where target_type = ?').get('frame')).toEqual({
        count: 0
      });
    });
  });
});
