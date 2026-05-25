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

  if (!existing) {
    db.prepare('insert into schema_migrations (version, applied_at) values (?, ?)').run(
      SCHEMA_VERSION,
      new Date().toISOString()
    );
  }

  return db;
}
