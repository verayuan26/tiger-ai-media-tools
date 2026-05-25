import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db/connection';

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
