import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { CREATE_SCHEMA_SQL, SCHEMA_VERSION } from './schema';

export type LibraryDatabase = Database.Database;

export function openDatabase(dbPath: string): LibraryDatabase {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(CREATE_SCHEMA_SQL);

  const existing = db
    .prepare('select version from schema_migrations where version = ?')
    .get(SCHEMA_VERSION);

  const appliedVersions = new Set(
    db
      .prepare('select version from schema_migrations')
      .all()
      .map((row) => Number((row as { version: number }).version))
  );

  if (!appliedVersions.has(1)) {
    db.prepare('insert into schema_migrations (version, applied_at) values (?, ?)').run(
      1,
      new Date().toISOString()
    );
    appliedVersions.add(1);
  }

  if (!appliedVersions.has(2)) {
    db.exec(`
      create table if not exists app_settings (
        id text primary key,
        api_protocol text not null default 'openai',
        api_endpoint text not null default 'https://api.openai.com/v1',
        api_key text not null default '',
        ai_provider_name text not null default 'mock' check (ai_provider_name in ('mock', 'openai-compatible')),
        daily_budget_yuan integer not null default 50,
        concurrent_tasks integer not null default 3,
        precision_mode_default integer not null default 0,
        reuse_parsed_results integer not null default 1,
        daily_spend_cents integer not null default 0,
        spend_day text not null default '',
        updated_at text not null
      );
    `);
    db.prepare('insert into schema_migrations (version, applied_at) values (?, ?)').run(
      2,
      new Date().toISOString()
    );
    appliedVersions.add(2);
  }

  if (!appliedVersions.has(3)) {
    const columns = db.prepare('pragma table_info(app_settings)').all() as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    if (!names.has('open_ai_vision_model')) {
      db.exec(`alter table app_settings add column open_ai_vision_model text not null default ''`);
    }
    if (!names.has('open_ai_transcribe_model')) {
      db.exec(`alter table app_settings add column open_ai_transcribe_model text not null default ''`);
    }
    db.prepare('insert into schema_migrations (version, applied_at) values (?, ?)').run(
      3,
      new Date().toISOString()
    );
    appliedVersions.add(3);
  }

  if (!appliedVersions.has(4)) {
    const assetColumns = db.prepare('pragma table_info(assets)').all() as Array<{ name: string }>;
    const assetColumnNames = new Set(assetColumns.map((column) => column.name));
    if (!assetColumnNames.has('frame_mode')) {
      db.exec(
        `alter table assets add column frame_mode text not null default 'balanced' check (frame_mode in ('balanced', 'precision'))`
      );
    }
    db.prepare('insert into schema_migrations (version, applied_at) values (?, ?)').run(
      4,
      new Date().toISOString()
    );
    appliedVersions.add(4);
  }

  if (!appliedVersions.has(5)) {
    const columns = db.prepare('pragma table_info(app_settings)').all() as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    if (!names.has('transcription_mode')) {
      db.exec(
        `alter table app_settings add column transcription_mode text not null default 'auto' check (transcription_mode in ('cloud', 'local', 'auto'))`
      );
    }
    if (!names.has('local_whisper_bin')) {
      db.exec(`alter table app_settings add column local_whisper_bin text not null default 'whisper-cli'`);
    }
    if (!names.has('local_whisper_model')) {
      db.exec(`alter table app_settings add column local_whisper_model text not null default ''`);
    }
    db.prepare('insert into schema_migrations (version, applied_at) values (?, ?)').run(
      5,
      new Date().toISOString()
    );
    appliedVersions.add(5);
  }

  if (!appliedVersions.has(6)) {
    const columns = db.prepare('pragma table_info(app_settings)').all() as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    if (!names.has('fallback_transcribe_endpoint')) {
      db.exec(`alter table app_settings add column fallback_transcribe_endpoint text not null default ''`);
    }
    if (!names.has('fallback_transcribe_model')) {
      db.exec(`alter table app_settings add column fallback_transcribe_model text not null default ''`);
    }
    if (!names.has('fallback_transcribe_api_key')) {
      db.exec(`alter table app_settings add column fallback_transcribe_api_key text not null default ''`);
    }
    db.exec(`update app_settings set transcription_mode = 'auto' where transcription_mode = 'local'`);
    db.prepare('insert into schema_migrations (version, applied_at) values (?, ?)').run(
      6,
      new Date().toISOString()
    );
    appliedVersions.add(6);
  }

  if (!appliedVersions.has(7)) {
    const columns = db.prepare('pragma table_info(app_settings)').all() as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    if (!names.has('fallback_transcribe_provider')) {
      db.exec(
        `alter table app_settings add column fallback_transcribe_provider text not null default 'openai-compatible' check (fallback_transcribe_provider in ('openai-compatible', 'dashscope-filetrans'))`
      );
    }
    db.prepare('insert into schema_migrations (version, applied_at) values (?, ?)').run(
      7,
      new Date().toISOString()
    );
    appliedVersions.add(7);
  }

  if (!appliedVersions.has(8)) {
    const columns = db.prepare('pragma table_info(app_settings)').all() as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    if (names.has('fallback_transcribe_provider')) {
      const rows = db
        .prepare('select id, fallback_transcribe_provider from app_settings')
        .all() as Array<{ id: string; fallback_transcribe_provider: string }>;
      db.exec('alter table app_settings drop column fallback_transcribe_provider');
      db.exec(
        `alter table app_settings add column fallback_transcribe_provider text not null default 'dashscope-asr'`
      );
      const update = db.prepare(
        'update app_settings set fallback_transcribe_provider = ? where id = ?'
      );
      for (const row of rows) {
        const provider =
          String(row.fallback_transcribe_provider) === 'openai-compatible'
            ? 'openai-compatible'
            : 'dashscope-asr';
        update.run(provider, row.id);
      }
    }
    db.prepare('insert into schema_migrations (version, applied_at) values (?, ?)').run(
      8,
      new Date().toISOString()
    );
    appliedVersions.add(8);
  }

  if (!appliedVersions.has(9)) {
    const columns = db.prepare('pragma table_info(app_settings)').all() as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    if (!names.has('ffmpeg_path')) {
      db.exec(`alter table app_settings add column ffmpeg_path text not null default ''`);
    }
    db.prepare('insert into schema_migrations (version, applied_at) values (?, ?)').run(
      9,
      new Date().toISOString()
    );
    appliedVersions.add(9);
  }

  if (!appliedVersions.has(10)) {
    const columns = db.prepare('pragma table_info(app_settings)').all() as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    if (!names.has('api_proxy_url')) {
      db.exec(`alter table app_settings add column api_proxy_url text not null default ''`);
    }
    db.prepare('insert into schema_migrations (version, applied_at) values (?, ?)').run(
      10,
      new Date().toISOString()
    );
  }

  return db;
}
