import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../db/connection';

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('database schema', () => {
  it('creates all MVP tables and enables foreign keys', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-db-'));
    const db = openDatabase(path.join(tempDir, 'library.sqlite'));

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
    db.close();
  });
});
