import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db/connection';
import { createId, createRepositories, normalizeTagName } from '../db/repositories';

let tempDir: string | null = null;
const NOW = '2026-05-26T00:00:00.000Z';

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

type TestDatabase = ReturnType<typeof openDatabase>;

function insertSource(db: TestDatabase) {
  db.prepare(
    `insert into library_sources (id, name, root_path, created_at)
     values (?, ?, ?, ?)`
  ).run('source-1', 'Library', '/media', NOW);
}

function insertAsset(db: TestDatabase, overrides: Partial<Record<string, unknown>> = {}) {
  const asset = {
    id: 'asset-1',
    sourceId: 'source-1',
    path: '/media/video.mp4',
    fileName: 'video.mp4',
    kind: 'video',
    extension: '.mp4',
    sizeBytes: 10,
    hash: 'hash-1',
    modifiedAt: NOW,
    status: 'done',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };

  db.prepare(
    `insert into assets (
      id,
      source_id,
      path,
      file_name,
      kind,
      extension,
      size_bytes,
      hash,
      modified_at,
      status,
      created_at,
      updated_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    asset.id,
    asset.sourceId,
    asset.path,
    asset.fileName,
    asset.kind,
    asset.extension,
    asset.sizeBytes,
    asset.hash,
    asset.modifiedAt,
    asset.status,
    asset.createdAt,
    asset.updatedAt
  );
}

function insertFrame(db: TestDatabase) {
  db.prepare(
    `insert into video_frames (id, asset_id, timestamp_seconds, thumbnail_path, strategy)
     values (?, ?, ?, ?, ?)`
  ).run('frame-1', 'asset-1', 1, '/thumbs/frame-1.jpg', 'keyframe');
}

function insertTag(db: TestDatabase) {
  db.prepare(
    `insert into tags (id, normalized_name, display_name, source)
     values (?, ?, ?, ?)`
  ).run('tag-1', 'outdoor', 'Outdoor', 'user');
}

describe('database schema', () => {
  it('creates all MVP tables and enables foreign keys', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-db-'));
    const db = openDatabase(path.join(tempDir, 'library.sqlite'));

    try {
      const tables = db
        .prepare("select name from sqlite_master where type = 'table' order by name")
        .all()
        .map((row) => (row as { name: string }).name);

      expect(tables).toEqual([
        'analysis_jobs',
        'asset_tags',
        'assets',
        'collection_assets',
        'collections',
        'library_sources',
        'schema_migrations',
        'tags',
        'transcript_segments',
        'video_frames'
      ]);

      expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    } finally {
      db.close();
    }
  });

  it('creates parent directories and enables WAL journaling', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-db-'));
    const dbPath = path.join(tempDir, 'nested', 'library.sqlite');
    const db = openDatabase(dbPath);

    try {
      expect(existsSync(path.dirname(dbPath))).toBe(true);
      expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
    } finally {
      db.close();
    }
  });

  it('records schema version once when reopening the same database', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-db-'));
    const dbPath = path.join(tempDir, 'library.sqlite');
    const first = openDatabase(dbPath);
    first.close();

    const second = openDatabase(dbPath);

    try {
      const rows = second
        .prepare('select version from schema_migrations order by version')
        .all();

      expect(rows).toEqual([{ version: 1 }]);
    } finally {
      second.close();
    }
  });

  it('rejects invalid asset kinds and missing foreign keys', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-db-'));
    const db = openDatabase(path.join(tempDir, 'library.sqlite'));

    try {
      expect(() => {
        insertAsset(db, {
          sourceId: 'missing-source',
          path: '/media/clip.bin',
          fileName: 'clip.bin',
          kind: 'document',
          extension: '.bin',
          hash: 'hash-1',
          status: 'pending'
        });
      }).toThrow();

      insertSource(db);

      expect(() => {
        insertAsset(db, {
          id: 'asset-2',
          path: '/media/doc.bin',
          fileName: 'doc.bin',
          kind: 'document',
          extension: '.bin',
          hash: 'hash-2',
          status: 'pending'
        });
      }).toThrow();
    } finally {
      db.close();
    }
  });

  it('enforces and cascades asset tag targets for assets and frames', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-db-'));
    const db = openDatabase(path.join(tempDir, 'library.sqlite'));

    try {
      insertSource(db);
      insertAsset(db);
      insertFrame(db);
      insertTag(db);

      expect(() => {
        db.prepare(
          `insert into asset_tags (id, target_type, target_id, tag_id)
           values (?, ?, ?, ?)`
        ).run('asset-tag-missing-asset', 'asset', 'missing-asset', 'tag-1');
      }).toThrow();

      expect(() => {
        db.prepare(
          `insert into asset_tags (id, target_type, target_id, tag_id)
           values (?, ?, ?, ?)`
        ).run('asset-tag-missing-frame', 'frame', 'missing-frame', 'tag-1');
      }).toThrow();

      db.prepare(
        `insert into asset_tags (id, target_type, target_id, tag_id)
         values (?, ?, ?, ?)`
      ).run('asset-tag-asset', 'asset', 'asset-1', 'tag-1');
      db.prepare(
        `insert into asset_tags (id, target_type, target_id, tag_id)
         values (?, ?, ?, ?)`
      ).run('asset-tag-frame', 'frame', 'frame-1', 'tag-1');

      expect(() => {
        db.prepare('update asset_tags set target_id = ? where id = ?').run(
          'missing-asset',
          'asset-tag-asset'
        );
      }).toThrow();

      expect(() => {
        db.prepare('update asset_tags set target_id = ? where id = ?').run(
          'missing-frame',
          'asset-tag-frame'
        );
      }).toThrow();

      db.prepare('delete from video_frames where id = ?').run('frame-1');
      expect(
        db
          .prepare('select count(*) as count from asset_tags where id = ?')
          .get('asset-tag-frame')
      ).toEqual({ count: 0 });

      db.prepare('delete from assets where id = ?').run('asset-1');
      expect(
        db
          .prepare('select count(*) as count from asset_tags where id = ?')
          .get('asset-tag-asset')
      ).toEqual({ count: 0 });
    } finally {
      db.close();
    }
  });
});

describe('repositories', () => {
  it('upserts sources, assets, jobs, tags, frames, and transcripts', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-repo-'));
    const db = openDatabase(path.join(tempDir, 'library.sqlite'));
    const repos = createRepositories(db);

    try {
      expect(createId('test')).toMatch(/^test_/);

      const source = repos.sources.upsertSource({
        name: 'Factory',
        rootPath: '/tmp/factory'
      });

      const asset = repos.assets.upsertAsset({
        sourceId: source.id,
        path: '/tmp/factory/cut.mp4',
        fileName: 'cut.mp4',
        kind: 'video',
        extension: '.mp4',
        sizeBytes: 12,
        hash: 'abc',
        modifiedAt: '2026-05-25T00:00:00.000Z'
      });

      repos.assets.setMetadata(asset.id, {
        durationSeconds: 10,
        width: 1920,
        height: 1080,
        thumbnailPath: '.data/thumbs/cut.jpg',
        status: 'done'
      });
      repos.assets.setMetadata(asset.id, { thumbnailPath: null });

      repos.jobs.ensureJobs(asset.id, ['metadata', 'thumbnail', 'frames', 'ai_vision']);
      repos.frames.replaceFrames(asset.id, [
        { timestampSeconds: 3, thumbnailPath: '.data/thumbs/cut-3.jpg', strategy: 'interval' }
      ]);
      repos.transcripts.replaceSegments(asset.id, [
        { startSeconds: 1, endSeconds: 4, language: 'zh', text: '这块面料先裁开', translation: null }
      ]);
      repos.tags.assignAssetTag(asset.id, '裁剪布料', 'ai', 0.91);

      const found = repos.assets.searchAssets({ tagNames: ['裁剪布料'], transcript: '面料' });

      expect(found).toHaveLength(1);
      expect(found[0]?.fileName).toBe('cut.mp4');
      expect(found[0]?.durationSeconds).toBe(10);
      expect(found[0]?.thumbnailPath).toBeNull();
      expect(repos.jobs.summary()).toMatchObject({ pending: 4, processing: 0, failed: 0 });
      expect(normalizeTagName(' Denim Fabric ')).toBe('denim fabric');
    } finally {
      db.close();
    }
  });

  it('keeps job creation idempotent and claims pending jobs atomically', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-repo-'));
    const db = openDatabase(path.join(tempDir, 'library.sqlite'));
    const repos = createRepositories(db);

    try {
      const source = repos.sources.upsertSource({ name: 'Factory', rootPath: '/tmp/factory' });
      const asset = repos.assets.upsertAsset({
        sourceId: source.id,
        path: '/tmp/factory/cut.mp4',
        fileName: 'cut.mp4',
        kind: 'video',
        extension: '.mp4',
        sizeBytes: 12,
        hash: 'abc',
        modifiedAt: '2026-05-25T00:00:00.000Z'
      });

      repos.jobs.ensureJobs(asset.id, ['metadata', 'thumbnail']);
      repos.jobs.ensureJobs(asset.id, ['metadata', 'thumbnail']);

      expect(repos.jobs.listForAsset(asset.id)).toHaveLength(2);

      const firstClaim = repos.jobs.claimNextPending();

      expect(firstClaim).toMatchObject({
        assetId: asset.id,
        status: 'processing',
        attempts: 1,
        errorMessage: null
      });
      expect(repos.jobs.listForAsset(asset.id).find((job) => job.id === firstClaim?.id)).toMatchObject({
        status: 'processing',
        attempts: 1,
        errorMessage: null
      });

      const secondClaim = repos.jobs.claimNextPending();

      expect(secondClaim).not.toBeNull();
      expect(secondClaim?.id).not.toBe(firstClaim?.id);
      expect(secondClaim).toMatchObject({ status: 'processing', attempts: 1 });
      expect(repos.jobs.claimNextPending()).toBeNull();
    } finally {
      db.close();
    }
  });

  it('stores failed job errors and retries failed jobs globally or by asset', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-repo-'));
    const db = openDatabase(path.join(tempDir, 'library.sqlite'));
    const repos = createRepositories(db);

    try {
      const source = repos.sources.upsertSource({ name: 'Factory', rootPath: '/tmp/factory' });
      const firstAsset = repos.assets.upsertAsset({
        sourceId: source.id,
        path: '/tmp/factory/cut.mp4',
        fileName: 'cut.mp4',
        kind: 'video',
        extension: '.mp4',
        sizeBytes: 12,
        hash: 'abc',
        modifiedAt: '2026-05-25T00:00:00.000Z'
      });
      const secondAsset = repos.assets.upsertAsset({
        sourceId: source.id,
        path: '/tmp/factory/stitch.mp4',
        fileName: 'stitch.mp4',
        kind: 'video',
        extension: '.mp4',
        sizeBytes: 24,
        hash: 'def',
        modifiedAt: '2026-05-25T00:00:00.000Z'
      });

      const firstJob = repos.jobs.ensureJobs(firstAsset.id, ['metadata'])[0];
      const secondJob = repos.jobs.ensureJobs(secondAsset.id, ['metadata'])[0];

      repos.jobs.updateStatus(firstJob.id, 'failed', 'ffprobe failed');
      repos.jobs.updateStatus(secondJob.id, 'failed', 'missing codec');

      expect(repos.jobs.listForAsset(firstAsset.id)[0]).toMatchObject({
        status: 'failed',
        errorMessage: 'ffprobe failed'
      });

      expect(repos.jobs.retryFailed(firstAsset.id)).toBe(1);
      expect(repos.jobs.listForAsset(firstAsset.id)[0]).toMatchObject({
        status: 'pending',
        errorMessage: null
      });
      expect(repos.jobs.listForAsset(secondAsset.id)[0]).toMatchObject({
        status: 'failed',
        errorMessage: 'missing codec'
      });

      expect(repos.jobs.retryFailed()).toBe(1);
      expect(repos.jobs.listForAsset(secondAsset.id)[0]).toMatchObject({
        status: 'pending',
        errorMessage: null
      });
    } finally {
      db.close();
    }
  });

  it('updates tag assignments and replaces frames and transcripts in sorted order', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-repo-'));
    const db = openDatabase(path.join(tempDir, 'library.sqlite'));
    const repos = createRepositories(db);

    try {
      const source = repos.sources.upsertSource({ name: 'Factory', rootPath: '/tmp/factory' });
      const asset = repos.assets.upsertAsset({
        sourceId: source.id,
        path: '/tmp/factory/cut.mp4',
        fileName: 'cut.mp4',
        kind: 'video',
        extension: '.mp4',
        sizeBytes: 12,
        hash: 'abc',
        modifiedAt: '2026-05-25T00:00:00.000Z'
      });

      repos.tags.assignAssetTag(asset.id, '裁剪布料', 'ai', 0.5);
      repos.tags.assignAssetTag(asset.id, ' 裁剪布料 ', 'ai', 0.95);

      expect(db.prepare('select count(*) as count from tags').get()).toEqual({ count: 1 });
      expect(db.prepare('select count(*) as count from asset_tags').get()).toEqual({ count: 1 });
      expect(db.prepare('select confidence from asset_tags').get()).toEqual({ confidence: 0.95 });

      repos.frames.replaceFrames(asset.id, [
        { timestampSeconds: 8, thumbnailPath: '.data/thumbs/cut-8.jpg', strategy: 'interval' },
        { timestampSeconds: 2, thumbnailPath: '.data/thumbs/cut-2.jpg', strategy: 'interval' }
      ]);
      repos.frames.replaceFrames(asset.id, [
        { timestampSeconds: 5, thumbnailPath: '.data/thumbs/cut-5.jpg', strategy: 'precision' },
        { timestampSeconds: 1, thumbnailPath: '.data/thumbs/cut-1.jpg', strategy: 'keyframe' }
      ]);

      expect(repos.frames.listForAsset(asset.id).map((frame) => frame.timestampSeconds)).toEqual([1, 5]);
      expect(repos.frames.listForAsset(asset.id).map((frame) => frame.thumbnailPath)).toEqual([
        '.data/thumbs/cut-1.jpg',
        '.data/thumbs/cut-5.jpg'
      ]);

      repos.transcripts.replaceSegments(asset.id, [
        { startSeconds: 10, endSeconds: 12, language: 'zh', text: '旧片段', translation: null }
      ]);
      repos.transcripts.replaceSegments(asset.id, [
        { startSeconds: 6, endSeconds: 8, language: 'zh', text: '后裁开', translation: null },
        { startSeconds: 1, endSeconds: 3, language: 'zh', text: '先铺布', translation: 'lay fabric' }
      ]);

      expect(repos.transcripts.listForAsset(asset.id).map((segment) => segment.startSeconds)).toEqual([1, 6]);
      expect(repos.transcripts.listForAsset(asset.id).map((segment) => segment.text)).toEqual([
        '先铺布',
        '后裁开'
      ]);
    } finally {
      db.close();
    }
  });
});
