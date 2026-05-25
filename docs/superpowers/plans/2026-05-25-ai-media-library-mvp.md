# AI Media Library MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first vertical MVP of a local AI-assisted media library: import a local folder, index media files in SQLite, run resumable analysis jobs, expose a local API, and browse/filter assets in a React UI.

**Architecture:** Use a local Node/TypeScript service for scanning, SQLite persistence, job orchestration, ffmpeg media processing, and AI provider calls. Use a Vite/React client served by the same local service during production, with the dev server proxying API calls during development. Keep AI integration behind a provider interface so the MVP can run with deterministic mock analysis and later switch to a cloud provider.

**Tech Stack:** Node 22, TypeScript, Express, SQLite via `better-sqlite3`, ffmpeg/ffprobe through `execa`, React, Vite, Vitest, Testing Library, Supertest, Playwright.

---

## Scope Check

This plan implements only the first MVP from `docs/superpowers/specs/2026-05-25-ai-media-library-design.md`.

Included:
- Local web app and local API.
- Folder import and incremental rescan.
- SQLite schema, repositories, search filters, and job state.
- Basic image/video/audio indexing.
- Video frame schedule planning and ffmpeg wrapper.
- Mock AI provider plus an OpenAI-compatible provider boundary.
- Background analysis jobs with retry and partial results.
- UI for sources, collections, filter chips, asset grid, asset detail, frame list, transcripts, and queue summary.
- Smoke tests and a tiny generated fixture set.

Deferred:
- Electron/Tauri desktop packaging.
- Full automatic file organizing, copy, move, rename, and bulk export.
- Deep music analysis such as BPM, emotion, lyrics, copyright, or melody similarity.
- Team accounts, cloud storage, and collaboration.

## File Structure

Create this structure:

```text
.
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── scripts/
│   └── make-fixtures.ts
├── src/
│   ├── shared/
│   │   ├── constants.ts
│   │   └── types.ts
│   ├── server/
│   │   ├── index.ts
│   │   ├── app.ts
│   │   ├── config.ts
│   │   ├── api/
│   │   │   └── routes.ts
│   │   ├── ai/
│   │   │   ├── provider.ts
│   │   │   ├── mockProvider.ts
│   │   │   └── openAiCompatibleProvider.ts
│   │   ├── db/
│   │   │   ├── connection.ts
│   │   │   ├── schema.ts
│   │   │   └── repositories.ts
│   │   ├── jobs/
│   │   │   ├── analysisPipeline.ts
│   │   │   └── jobRunner.ts
│   │   ├── media/
│   │   │   ├── ffmpeg.ts
│   │   │   └── framePlan.ts
│   │   ├── scanner/
│   │   │   ├── fileTypes.ts
│   │   │   └── scanner.ts
│   │   └── tests/
│   │       ├── db.test.ts
│   │       ├── scanner.test.ts
│   │       ├── jobRunner.test.ts
│   │       ├── analysisPipeline.test.ts
│   │       └── api.test.ts
│   └── client/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api.ts
│       ├── styles.css
│       └── components/
│           ├── AssetDetail.tsx
│           ├── AssetGrid.tsx
│           ├── FilterBar.tsx
│           ├── Sidebar.tsx
│           └── QueueSummary.tsx
└── tests/
    └── e2e/
        └── smoke.spec.ts
```

Responsibility boundaries:
- `src/shared/*`: API and domain types shared by client and server.
- `src/server/db/*`: SQLite schema, migration, and repository operations. No ffmpeg or HTTP code here.
- `src/server/scanner/*`: filesystem traversal, file type detection, hashing, and source import orchestration.
- `src/server/media/*`: frame planning and ffmpeg/ffprobe command boundaries.
- `src/server/ai/*`: AI provider contract and concrete providers.
- `src/server/jobs/*`: task state transitions and analysis workflow.
- `src/server/api/*`: Express routes only; delegate business logic to repositories, scanner, and runner.
- `src/client/*`: React UI and HTTP client only.

---

### Task 1: Project Scaffold And Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Write the package manifest**

Create `package.json`:

```json
{
  "name": "ai-media-tools",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx src/server/index.ts",
    "dev:client": "vite --host 127.0.0.1",
    "build": "tsc --noEmit && vite build",
    "start": "tsx src/server/index.ts",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "fixtures": "tsx scripts/make-fixtures.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "^5.0.0",
    "better-sqlite3": "^11.8.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "execa": "^9.5.2",
    "express": "^4.21.2",
    "mime-types": "^2.1.35",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.1",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@types/better-sqlite3": "^7.6.12",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/mime-types": "^2.1.4",
    "@types/node": "^22.10.5",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "jsdom": "^25.0.1",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vite": "^6.0.6",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Add TypeScript and test configuration**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "scripts", "tests", "*.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  root: 'src/client',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8787'
    }
  }
});
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: true,
    coverage: {
      reporter: ['text', 'html']
    }
  }
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: [
    {
      command: 'npm run dev',
      port: 8787,
      reuseExistingServer: true
    },
    {
      command: 'npm run dev:client',
      port: 5173,
      reuseExistingServer: true
    }
  ]
});
```

- [ ] **Step 3: Add environment sample and ignore generated state**

Create `.env.example`:

```bash
AI_MEDIA_DATA_DIR=.data
AI_MEDIA_PORT=8787
AI_PROVIDER=mock
AI_OPENAI_BASE_URL=https://api.openai.com/v1
AI_OPENAI_API_KEY=
AI_OPENAI_VISION_MODEL=
AI_OPENAI_TRANSCRIBE_MODEL=
AI_DAILY_BUDGET_CENTS=1000
```

Modify `.gitignore` so it contains:

```gitignore
.superpowers/
node_modules/
dist/
.data/
coverage/
playwright-report/
test-results/
.env
```

- [ ] **Step 4: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and npm exits with code `0`.

- [ ] **Step 5: Verify baseline tooling**

Run:

```bash
npm run typecheck
npm test
```

Expected:
- `npm run typecheck` passes because no source files exist yet.
- `npm test` exits successfully with no tests or reports no matching tests without TypeScript errors.

- [ ] **Step 6: Commit scaffold**

```bash
git add .gitignore .env.example package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts playwright.config.ts
git commit -m "chore: scaffold TypeScript media library app"
```

---

### Task 2: Shared Domain Types And File Type Detection

**Files:**
- Create: `src/shared/constants.ts`
- Create: `src/shared/types.ts`
- Create: `src/server/scanner/fileTypes.ts`
- Create: `src/server/tests/scanner.test.ts`

- [ ] **Step 1: Write failing tests for file classification**

Create `src/server/tests/scanner.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/server/tests/scanner.test.ts
```

Expected: FAIL because `../scanner/fileTypes` does not exist.

- [ ] **Step 3: Create shared constants and types**

Create `src/shared/constants.ts`:

```ts
export const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.tif', '.tiff'] as const;
export const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm'] as const;
export const SUPPORTED_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'] as const;

export const JOB_STATUSES = ['pending', 'processing', 'partial', 'done', 'failed', 'skipped'] as const;
export const JOB_STAGES = ['metadata', 'thumbnail', 'frames', 'audio', 'ai_vision', 'ai_transcript'] as const;
```

Create `src/shared/types.ts`:

```ts
import type { JOB_STAGES, JOB_STATUSES } from './constants';

export type MediaKind = 'image' | 'video' | 'audio';
export type JobStatus = (typeof JOB_STATUSES)[number];
export type JobStage = (typeof JOB_STAGES)[number];
export type TagSource = 'system' | 'ai' | 'user';
export type TagTargetType = 'asset' | 'frame';

export interface LibrarySource {
  id: string;
  name: string;
  rootPath: string;
  incrementalScanEnabled: boolean;
  lastScannedAt: string | null;
  createdAt: string;
}

export interface Asset {
  id: string;
  sourceId: string;
  path: string;
  fileName: string;
  kind: MediaKind;
  extension: string;
  sizeBytes: number;
  hash: string;
  modifiedAt: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  status: JobStatus;
  thumbnailPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VideoFrame {
  id: string;
  assetId: string;
  timestampSeconds: number;
  thumbnailPath: string;
  strategy: 'keyframe' | 'interval' | 'precision';
}

export interface TranscriptSegment {
  id: string;
  assetId: string;
  startSeconds: number;
  endSeconds: number;
  language: string;
  text: string;
  translation: string | null;
}

export interface Tag {
  id: string;
  normalizedName: string;
  displayName: string;
  source: TagSource;
}

export interface AssetTag {
  id: string;
  targetType: TagTargetType;
  targetId: string;
  tagId: string;
  confidence: number | null;
}

export interface Collection {
  id: string;
  name: string;
  source: 'manual' | 'ai';
  confirmed: boolean;
  createdAt: string;
}

export interface AnalysisJob {
  id: string;
  assetId: string;
  stage: JobStage;
  status: JobStatus;
  attempts: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetSearchFilters {
  collectionId?: string;
  kinds?: MediaKind[];
  tagNames?: string[];
  transcript?: string;
  query?: string;
}

export interface QueueSummary {
  pending: number;
  processing: number;
  partial: number;
  done: number;
  failed: number;
  skipped: number;
}
```

- [ ] **Step 4: Implement file classification**

Create `src/server/scanner/fileTypes.ts`:

```ts
import path from 'node:path';
import {
  SUPPORTED_AUDIO_EXTENSIONS,
  SUPPORTED_IMAGE_EXTENSIONS,
  SUPPORTED_VIDEO_EXTENSIONS
} from '../../shared/constants';
import type { MediaKind } from '../../shared/types';

export interface ClassifiedMediaFile {
  kind: MediaKind;
  extension: string;
}

export function classifyMediaFile(filePath: string): ClassifiedMediaFile | null {
  const extension = path.extname(filePath).toLowerCase();

  if ((SUPPORTED_IMAGE_EXTENSIONS as readonly string[]).includes(extension)) {
    return { kind: 'image', extension };
  }

  if ((SUPPORTED_VIDEO_EXTENSIONS as readonly string[]).includes(extension)) {
    return { kind: 'video', extension };
  }

  if ((SUPPORTED_AUDIO_EXTENSIONS as readonly string[]).includes(extension)) {
    return { kind: 'audio', extension };
  }

  return null;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
npm test -- src/server/tests/scanner.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit domain types**

```bash
git add src/shared src/server/scanner src/server/tests/scanner.test.ts
git commit -m "feat: add media domain types and file classification"
```

---

### Task 3: SQLite Schema And Database Connection

**Files:**
- Create: `src/server/db/schema.ts`
- Create: `src/server/db/connection.ts`
- Create: `src/server/tests/db.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `src/server/tests/db.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/server/tests/db.test.ts
```

Expected: FAIL because `../db/connection` does not exist.

- [ ] **Step 3: Implement schema SQL**

Create `src/server/db/schema.ts`:

```ts
export const SCHEMA_VERSION = 1;

export const CREATE_SCHEMA_SQL = `
create table if not exists schema_migrations (
  version integer primary key,
  applied_at text not null
);

create table if not exists library_sources (
  id text primary key,
  name text not null,
  root_path text not null unique,
  incremental_scan_enabled integer not null default 1,
  last_scanned_at text,
  created_at text not null
);

create table if not exists assets (
  id text primary key,
  source_id text not null references library_sources(id) on delete cascade,
  path text not null unique,
  file_name text not null,
  kind text not null check (kind in ('image', 'video', 'audio')),
  extension text not null,
  size_bytes integer not null,
  hash text not null,
  modified_at text not null,
  duration_seconds real,
  width integer,
  height integer,
  status text not null check (status in ('pending', 'processing', 'partial', 'done', 'failed', 'skipped')),
  thumbnail_path text,
  created_at text not null,
  updated_at text not null
);

create table if not exists video_frames (
  id text primary key,
  asset_id text not null references assets(id) on delete cascade,
  timestamp_seconds real not null,
  thumbnail_path text not null,
  strategy text not null check (strategy in ('keyframe', 'interval', 'precision'))
);

create table if not exists transcript_segments (
  id text primary key,
  asset_id text not null references assets(id) on delete cascade,
  start_seconds real not null,
  end_seconds real not null,
  language text not null,
  text text not null,
  translation text
);

create table if not exists tags (
  id text primary key,
  normalized_name text not null unique,
  display_name text not null,
  source text not null check (source in ('system', 'ai', 'user'))
);

create table if not exists asset_tags (
  id text primary key,
  target_type text not null check (target_type in ('asset', 'frame')),
  target_id text not null,
  tag_id text not null references tags(id) on delete cascade,
  confidence real,
  unique(target_type, target_id, tag_id)
);

create table if not exists collections (
  id text primary key,
  name text not null unique,
  source text not null check (source in ('manual', 'ai')),
  confirmed integer not null default 0,
  created_at text not null
);

create table if not exists collection_assets (
  collection_id text not null references collections(id) on delete cascade,
  asset_id text not null references assets(id) on delete cascade,
  primary key (collection_id, asset_id)
);

create table if not exists analysis_jobs (
  id text primary key,
  asset_id text not null references assets(id) on delete cascade,
  stage text not null check (stage in ('metadata', 'thumbnail', 'frames', 'audio', 'ai_vision', 'ai_transcript')),
  status text not null check (status in ('pending', 'processing', 'partial', 'done', 'failed', 'skipped')),
  attempts integer not null default 0,
  error_message text,
  created_at text not null,
  updated_at text not null,
  unique(asset_id, stage)
);

create index if not exists idx_assets_source on assets(source_id);
create index if not exists idx_assets_kind on assets(kind);
create index if not exists idx_assets_status on assets(status);
create index if not exists idx_frames_asset on video_frames(asset_id);
create index if not exists idx_transcripts_asset on transcript_segments(asset_id);
create index if not exists idx_jobs_status on analysis_jobs(status);
create index if not exists idx_jobs_asset on analysis_jobs(asset_id);
`;
```

- [ ] **Step 4: Implement database opening and migration**

Create `src/server/db/connection.ts`:

```ts
import Database from 'better-sqlite3';
import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
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
```

- [ ] **Step 5: Run schema test**

Run:

```bash
npm test -- src/server/tests/db.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit database schema**

```bash
git add src/server/db src/server/tests/db.test.ts
git commit -m "feat: add SQLite schema and connection"
```

---

### Task 4: Repositories For Sources, Assets, Tags, Frames, Transcripts, And Jobs

**Files:**
- Modify: `src/server/db/repositories.ts`
- Modify: `src/server/tests/db.test.ts`

- [ ] **Step 1: Add failing repository tests**

Append to `src/server/tests/db.test.ts`:

```ts
import {
  createRepositories,
  createId,
  normalizeTagName
} from '../db/repositories';

describe('repositories', () => {
  it('upserts sources, assets, jobs, tags, frames, and transcripts', () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-repo-'));
    const db = openDatabase(path.join(tempDir, 'library.sqlite'));
    const repos = createRepositories(db);

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
    expect(repos.jobs.summary()).toMatchObject({ pending: 4, processing: 0, failed: 0 });
    expect(normalizeTagName(' Denim Fabric ')).toBe('denim fabric');
    db.close();
  });
});
```

- [ ] **Step 2: Run the repository test to verify it fails**

Run:

```bash
npm test -- src/server/tests/db.test.ts
```

Expected: FAIL because `../db/repositories` does not exist.

- [ ] **Step 3: Implement repositories**

Create `src/server/db/repositories.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { LibraryDatabase } from './connection';
import type {
  AnalysisJob,
  Asset,
  AssetSearchFilters,
  JobStage,
  JobStatus,
  LibrarySource,
  MediaKind,
  QueueSummary,
  TagSource,
  TranscriptSegment,
  VideoFrame
} from '../../shared/types';

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function mapJob(row: Record<string, unknown>): AnalysisJob {
  return {
    id: String(row.id),
    assetId: String(row.asset_id),
    stage: row.stage as JobStage,
    status: row.status as JobStatus,
    attempts: Number(row.attempts),
    errorMessage: row.error_message === null ? null : String(row.error_message),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

interface SourceInput {
  name: string;
  rootPath: string;
}

interface AssetInput {
  sourceId: string;
  path: string;
  fileName: string;
  kind: MediaKind;
  extension: string;
  sizeBytes: number;
  hash: string;
  modifiedAt: string;
}

interface FrameInput {
  timestampSeconds: number;
  thumbnailPath: string;
  strategy: VideoFrame['strategy'];
}

interface TranscriptInput {
  startSeconds: number;
  endSeconds: number;
  language: string;
  text: string;
  translation: string | null;
}

function mapAsset(row: Record<string, unknown>): Asset {
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    path: String(row.path),
    fileName: String(row.file_name),
    kind: row.kind as MediaKind,
    extension: String(row.extension),
    sizeBytes: Number(row.size_bytes),
    hash: String(row.hash),
    modifiedAt: String(row.modified_at),
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    width: row.width === null ? null : Number(row.width),
    height: row.height === null ? null : Number(row.height),
    status: row.status as JobStatus,
    thumbnailPath: row.thumbnail_path === null ? null : String(row.thumbnail_path),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function createRepositories(db: LibraryDatabase) {
  const sources = {
    upsertSource(input: SourceInput): LibrarySource {
      const existing = db.prepare('select * from library_sources where root_path = ?').get(input.rootPath) as
        | Record<string, unknown>
        | undefined;
      const timestamp = nowIso();

      if (existing) {
        db.prepare('update library_sources set name = ? where id = ?').run(input.name, existing.id);
        return sources.getById(String(existing.id)) as LibrarySource;
      }

      const id = createId('src');
      db.prepare(
        `insert into library_sources
          (id, name, root_path, incremental_scan_enabled, last_scanned_at, created_at)
         values (?, ?, ?, 1, null, ?)`
      ).run(id, input.name, input.rootPath, timestamp);
      return sources.getById(id) as LibrarySource;
    },

    getById(id: string): LibrarySource | null {
      const row = db.prepare('select * from library_sources where id = ?').get(id) as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        id: String(row.id),
        name: String(row.name),
        rootPath: String(row.root_path),
        incrementalScanEnabled: Boolean(row.incremental_scan_enabled),
        lastScannedAt: row.last_scanned_at === null ? null : String(row.last_scanned_at),
        createdAt: String(row.created_at)
      };
    },

    list(): LibrarySource[] {
      return db
        .prepare('select * from library_sources order by created_at desc')
        .all()
        .map((row) => sources.getById(String((row as { id: string }).id)) as LibrarySource);
    },

    markScanned(id: string): void {
      db.prepare('update library_sources set last_scanned_at = ? where id = ?').run(nowIso(), id);
    }
  };

  const assets = {
    upsertAsset(input: AssetInput): Asset {
      const existing = db.prepare('select * from assets where path = ?').get(input.path) as Record<string, unknown> | undefined;
      const timestamp = nowIso();

      if (existing) {
        db.prepare(
          `update assets
           set size_bytes = ?, hash = ?, modified_at = ?, status = 'pending', updated_at = ?
           where id = ?`
        ).run(input.sizeBytes, input.hash, input.modifiedAt, timestamp, existing.id);
        return assets.getById(String(existing.id)) as Asset;
      }

      const id = createId('asset');
      db.prepare(
        `insert into assets
          (id, source_id, path, file_name, kind, extension, size_bytes, hash, modified_at,
           duration_seconds, width, height, status, thumbnail_path, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, null, null, null, 'pending', null, ?, ?)`
      ).run(
        id,
        input.sourceId,
        input.path,
        input.fileName,
        input.kind,
        input.extension,
        input.sizeBytes,
        input.hash,
        input.modifiedAt,
        timestamp,
        timestamp
      );
      return assets.getById(id) as Asset;
    },

    getById(id: string): Asset | null {
      const row = db.prepare('select * from assets where id = ?').get(id) as Record<string, unknown> | undefined;
      return row ? mapAsset(row) : null;
    },

    setMetadata(id: string, metadata: { durationSeconds?: number | null; width?: number | null; height?: number | null; thumbnailPath?: string | null; status?: JobStatus }): void {
      const current = assets.getById(id);
      if (!current) return;
      db.prepare(
        `update assets
         set duration_seconds = ?, width = ?, height = ?, thumbnail_path = ?, status = ?, updated_at = ?
         where id = ?`
      ).run(
        metadata.durationSeconds ?? current.durationSeconds,
        metadata.width ?? current.width,
        metadata.height ?? current.height,
        metadata.thumbnailPath ?? current.thumbnailPath,
        metadata.status ?? current.status,
        nowIso(),
        id
      );
    },

    listBySource(sourceId: string): Asset[] {
      return db
        .prepare('select * from assets where source_id = ? order by file_name')
        .all(sourceId)
        .map((row) => mapAsset(row as Record<string, unknown>));
    },

    searchAssets(filters: AssetSearchFilters): Asset[] {
      const clauses: string[] = [];
      const params: unknown[] = [];

      if (filters.kinds?.length) {
        clauses.push(`a.kind in (${filters.kinds.map(() => '?').join(', ')})`);
        params.push(...filters.kinds);
      }

      if (filters.query) {
        clauses.push('(a.file_name like ? or a.path like ?)');
        params.push(`%${filters.query}%`, `%${filters.query}%`);
      }

      if (filters.tagNames?.length) {
        for (const tagName of filters.tagNames) {
          clauses.push(`exists (
            select 1 from asset_tags at
            join tags t on t.id = at.tag_id
            where at.target_id = a.id and at.target_type = 'asset' and t.normalized_name = ?
          )`);
          params.push(normalizeTagName(tagName));
        }
      }

      if (filters.transcript) {
        clauses.push(`exists (
          select 1 from transcript_segments ts
          where ts.asset_id = a.id and ts.text like ?
        )`);
        params.push(`%${filters.transcript}%`);
      }

      if (filters.collectionId) {
        clauses.push(`exists (
          select 1 from collection_assets ca
          where ca.asset_id = a.id and ca.collection_id = ?
        )`);
        params.push(filters.collectionId);
      }

      const where = clauses.length ? `where ${clauses.join(' and ')}` : '';
      return db
        .prepare(`select a.* from assets a ${where} order by a.updated_at desc limit 200`)
        .all(...params)
        .map((row) => mapAsset(row as Record<string, unknown>));
    }
  };

  const jobs = {
    ensureJobs(assetId: string, stages: JobStage[]): AnalysisJob[] {
      const timestamp = nowIso();
      for (const stage of stages) {
        db.prepare(
          `insert or ignore into analysis_jobs
            (id, asset_id, stage, status, attempts, error_message, created_at, updated_at)
           values (?, ?, ?, 'pending', 0, null, ?, ?)`
        ).run(createId('job'), assetId, stage, timestamp, timestamp);
      }
      return jobs.listForAsset(assetId);
    },

    listForAsset(assetId: string): AnalysisJob[] {
      return db
        .prepare('select * from analysis_jobs where asset_id = ? order by created_at')
        .all(assetId)
        .map((row) => mapJob(row as Record<string, unknown>));
    },

    nextPending(): AnalysisJob | null {
      const row = db
        .prepare("select * from analysis_jobs where status = 'pending' order by created_at limit 1")
        .get() as Record<string, unknown> | undefined;
      return row ? mapJob(row) : null;
    },

    updateStatus(jobId: string, status: JobStatus, errorMessage: string | null = null): void {
      db.prepare(
        `update analysis_jobs
         set status = ?, error_message = ?, attempts = attempts + case when ? = 'processing' then 1 else 0 end, updated_at = ?
         where id = ?`
      ).run(status, errorMessage, status, nowIso(), jobId);
    },

    retryFailed(assetId?: string): number {
      const result = assetId
        ? db
            .prepare("update analysis_jobs set status = 'pending', error_message = null, updated_at = ? where status = 'failed' and asset_id = ?")
            .run(nowIso(), assetId)
        : db
            .prepare("update analysis_jobs set status = 'pending', error_message = null, updated_at = ? where status = 'failed'")
            .run(nowIso());
      return Number(result.changes);
    },

    summary(): QueueSummary {
      const summary: QueueSummary = { pending: 0, processing: 0, partial: 0, done: 0, failed: 0, skipped: 0 };
      const rows = db.prepare('select status, count(*) as count from analysis_jobs group by status').all() as Array<{
        status: JobStatus;
        count: number;
      }>;
      for (const row of rows) summary[row.status] = Number(row.count);
      return summary;
    }
  };

  const tags = {
    getOrCreate(displayName: string, source: TagSource): string {
      const normalized = normalizeTagName(displayName);
      const existing = db.prepare('select id from tags where normalized_name = ?').get(normalized) as { id: string } | undefined;
      if (existing) return existing.id;

      const id = createId('tag');
      db.prepare('insert into tags (id, normalized_name, display_name, source) values (?, ?, ?, ?)').run(
        id,
        normalized,
        displayName.trim(),
        source
      );
      return id;
    },

    assignAssetTag(assetId: string, displayName: string, source: TagSource, confidence: number | null): void {
      const tagId = tags.getOrCreate(displayName, source);
      db.prepare(
        `insert or replace into asset_tags (id, target_type, target_id, tag_id, confidence)
         values (
           coalesce((select id from asset_tags where target_type = 'asset' and target_id = ? and tag_id = ?), ?),
           'asset',
           ?,
           ?,
           ?
         )`
      ).run(assetId, tagId, createId('atag'), assetId, tagId, confidence);
    }
  };

  const frames = {
    replaceFrames(assetId: string, input: FrameInput[]): void {
      db.prepare('delete from video_frames where asset_id = ?').run(assetId);
      const insert = db.prepare(
        `insert into video_frames (id, asset_id, timestamp_seconds, thumbnail_path, strategy)
         values (?, ?, ?, ?, ?)`
      );
      for (const frame of input) {
        insert.run(createId('frame'), assetId, frame.timestampSeconds, frame.thumbnailPath, frame.strategy);
      }
    },

    listForAsset(assetId: string): VideoFrame[] {
      return db
        .prepare('select * from video_frames where asset_id = ? order by timestamp_seconds')
        .all(assetId)
        .map((row) => ({
          id: String((row as Record<string, unknown>).id),
          assetId: String((row as Record<string, unknown>).asset_id),
          timestampSeconds: Number((row as Record<string, unknown>).timestamp_seconds),
          thumbnailPath: String((row as Record<string, unknown>).thumbnail_path),
          strategy: (row as Record<string, unknown>).strategy as VideoFrame['strategy']
        }));
    }
  };

  const transcripts = {
    replaceSegments(assetId: string, input: TranscriptInput[]): void {
      db.prepare('delete from transcript_segments where asset_id = ?').run(assetId);
      const insert = db.prepare(
        `insert into transcript_segments
          (id, asset_id, start_seconds, end_seconds, language, text, translation)
         values (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const segment of input) {
        insert.run(
          createId('tx'),
          assetId,
          segment.startSeconds,
          segment.endSeconds,
          segment.language,
          segment.text,
          segment.translation
        );
      }
    },

    listForAsset(assetId: string): TranscriptSegment[] {
      return db
        .prepare('select * from transcript_segments where asset_id = ? order by start_seconds')
        .all(assetId)
        .map((row) => ({
          id: String((row as Record<string, unknown>).id),
          assetId: String((row as Record<string, unknown>).asset_id),
          startSeconds: Number((row as Record<string, unknown>).start_seconds),
          endSeconds: Number((row as Record<string, unknown>).end_seconds),
          language: String((row as Record<string, unknown>).language),
          text: String((row as Record<string, unknown>).text),
          translation: (row as Record<string, unknown>).translation === null ? null : String((row as Record<string, unknown>).translation)
        }));
    }
  };

  return { sources, assets, jobs, tags, frames, transcripts };
}
```

- [ ] **Step 4: Run repository tests**

Run:

```bash
npm test -- src/server/tests/db.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit repositories**

```bash
git add src/server/db/repositories.ts src/server/tests/db.test.ts
git commit -m "feat: add media library repositories"
```

---

### Task 5: Folder Scanner And Incremental Import

**Files:**
- Create: `src/server/scanner/scanner.ts`
- Modify: `src/server/tests/scanner.test.ts`

- [ ] **Step 1: Add failing scanner tests**

Append to `src/server/tests/scanner.test.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach } from 'vitest';
import { openDatabase } from '../db/connection';
import { createRepositories } from '../db/repositories';
import { importSourceDirectory } from '../scanner/scanner';

let scannerTempDir: string | null = null;

afterEach(() => {
  if (scannerTempDir) {
    rmSync(scannerTempDir, { recursive: true, force: true });
    scannerTempDir = null;
  }
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
```

- [ ] **Step 2: Run the scanner test to verify it fails**

Run:

```bash
npm test -- src/server/tests/scanner.test.ts
```

Expected: FAIL because `../scanner/scanner` does not exist.

- [ ] **Step 3: Implement scanner**

Create `src/server/scanner/scanner.ts`:

```ts
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { opendir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { JobStage } from '../../shared/types';
import type { createRepositories } from '../db/repositories';
import { classifyMediaFile } from './fileTypes';

type Repositories = ReturnType<typeof createRepositories>;

export interface ImportSourceInput {
  rootPath: string;
  name: string;
}

export interface ImportSourceResult {
  sourceId: string;
  indexed: number;
  skipped: number;
}

export async function hashFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

async function* walkFiles(rootPath: string): AsyncGenerator<string> {
  const dir = await opendir(rootPath);
  for await (const entry of dir) {
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

function stagesForKind(kind: 'image' | 'video' | 'audio'): JobStage[] {
  if (kind === 'video') return ['metadata', 'thumbnail', 'frames', 'audio', 'ai_vision', 'ai_transcript'];
  if (kind === 'image') return ['metadata', 'thumbnail', 'ai_vision'];
  return ['metadata'];
}

export async function importSourceDirectory(
  repos: Repositories,
  input: ImportSourceInput
): Promise<ImportSourceResult> {
  const source = repos.sources.upsertSource({
    name: input.name,
    rootPath: input.rootPath
  });

  let indexed = 0;
  let skipped = 0;

  for await (const filePath of walkFiles(input.rootPath)) {
    const classified = classifyMediaFile(filePath);
    if (!classified) {
      skipped += 1;
      continue;
    }

    const fileStat = await stat(filePath);
    const asset = repos.assets.upsertAsset({
      sourceId: source.id,
      path: filePath,
      fileName: path.basename(filePath),
      kind: classified.kind,
      extension: classified.extension,
      sizeBytes: fileStat.size,
      hash: await hashFile(filePath),
      modifiedAt: fileStat.mtime.toISOString()
    });
    repos.jobs.ensureJobs(asset.id, stagesForKind(asset.kind));
    indexed += 1;
  }

  repos.sources.markScanned(source.id);
  return { sourceId: source.id, indexed, skipped };
}
```

- [ ] **Step 4: Run scanner tests**

Run:

```bash
npm test -- src/server/tests/scanner.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit scanner**

```bash
git add src/server/scanner src/server/tests/scanner.test.ts
git commit -m "feat: add folder import scanner"
```

---

### Task 6: Frame Planning And ffmpeg Boundary

**Files:**
- Create: `src/server/media/framePlan.ts`
- Create: `src/server/media/ffmpeg.ts`
- Create: `src/server/tests/analysisPipeline.test.ts`

- [ ] **Step 1: Write failing frame planning tests**

Create `src/server/tests/analysisPipeline.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { planFrameTimestamps } from '../media/framePlan';

describe('planFrameTimestamps', () => {
  it('uses interval fallback for normal mode', () => {
    expect(planFrameTimestamps({ durationSeconds: 30, mode: 'balanced', fallbackIntervalSeconds: 10 })).toEqual([
      0,
      10,
      20,
      30
    ]);
  });

  it('uses three second precision mode for detailed inspection', () => {
    expect(planFrameTimestamps({ durationSeconds: 9, mode: 'precision', fallbackIntervalSeconds: 10 })).toEqual([
      0,
      3,
      6,
      9
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/server/tests/analysisPipeline.test.ts
```

Expected: FAIL because `../media/framePlan` does not exist.

- [ ] **Step 3: Implement frame planning**

Create `src/server/media/framePlan.ts`:

```ts
export interface FramePlanInput {
  durationSeconds: number;
  mode: 'balanced' | 'precision';
  fallbackIntervalSeconds: number;
}

export function planFrameTimestamps(input: FramePlanInput): number[] {
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds < 0) {
    return [];
  }

  const interval = input.mode === 'precision' ? 3 : input.fallbackIntervalSeconds;
  const safeInterval = Math.max(1, Math.floor(interval));
  const duration = Math.floor(input.durationSeconds);
  const timestamps: number[] = [];

  for (let second = 0; second <= duration; second += safeInterval) {
    timestamps.push(second);
  }

  if (timestamps[timestamps.length - 1] !== duration) {
    timestamps.push(duration);
  }

  return Array.from(new Set(timestamps));
}
```

- [ ] **Step 4: Add ffmpeg wrapper**

Create `src/server/media/ffmpeg.ts`:

```ts
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import { planFrameTimestamps } from './framePlan';

export interface MediaMetadata {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
}

export interface ExtractedFrame {
  timestampSeconds: number;
  thumbnailPath: string;
}

export async function probeMedia(filePath: string): Promise<MediaMetadata> {
  const { stdout } = await execa('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration:stream=width,height',
    '-of',
    'json',
    filePath
  ]);
  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{ width?: number; height?: number }>;
  };
  const videoStream = parsed.streams?.find((stream) => stream.width && stream.height);
  return {
    durationSeconds: parsed.format?.duration ? Number(parsed.format.duration) : null,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null
  };
}

export async function extractVideoFrames(input: {
  filePath: string;
  assetId: string;
  durationSeconds: number;
  outputDir: string;
  mode: 'balanced' | 'precision';
}): Promise<ExtractedFrame[]> {
  await mkdir(input.outputDir, { recursive: true });
  const timestamps = planFrameTimestamps({
    durationSeconds: input.durationSeconds,
    mode: input.mode,
    fallbackIntervalSeconds: 8
  });

  const frames: ExtractedFrame[] = [];
  for (const timestamp of timestamps) {
    const outputPath = path.join(input.outputDir, `${input.assetId}-${timestamp}.jpg`);
    await execa('ffmpeg', [
      '-y',
      '-ss',
      String(timestamp),
      '-i',
      input.filePath,
      '-frames:v',
      '1',
      '-vf',
      'scale=480:-1',
      outputPath
    ]);
    frames.push({ timestampSeconds: timestamp, thumbnailPath: outputPath });
  }

  return frames;
}
```

- [ ] **Step 5: Run frame tests**

Run:

```bash
npm test -- src/server/tests/analysisPipeline.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit media boundary**

```bash
git add src/server/media src/server/tests/analysisPipeline.test.ts
git commit -m "feat: add video frame planning and ffmpeg boundary"
```

---

### Task 7: AI Provider Contract And Mock Provider

**Files:**
- Create: `src/server/ai/provider.ts`
- Create: `src/server/ai/mockProvider.ts`
- Create: `src/server/ai/openAiCompatibleProvider.ts`
- Modify: `src/server/tests/analysisPipeline.test.ts`

- [ ] **Step 1: Add failing AI provider test**

Append to `src/server/tests/analysisPipeline.test.ts`:

```ts
import { createMockAiProvider } from '../ai/mockProvider';

describe('mock AI provider', () => {
  it('returns deterministic tags and transcript segments', async () => {
    const provider = createMockAiProvider();

    await expect(provider.analyzeImage({ imagePath: '/tmp/factory_cutting.jpg' })).resolves.toMatchObject({
      tags: [{ displayName: '裁剪布料', confidence: 0.88 }]
    });

    await expect(provider.transcribeAudio({ audioPath: '/tmp/worker_talk_ru.wav' })).resolves.toMatchObject({
      segments: [{ language: 'ru', text: 'Пример разговора о ткани' }]
    });
  });
});
```

- [ ] **Step 2: Run AI provider test to verify it fails**

Run:

```bash
npm test -- src/server/tests/analysisPipeline.test.ts
```

Expected: FAIL because `../ai/mockProvider` does not exist.

- [ ] **Step 3: Create AI provider contract**

Create `src/server/ai/provider.ts`:

```ts
export interface VisualTagResult {
  displayName: string;
  confidence: number;
}

export interface ImageAnalysisResult {
  tags: VisualTagResult[];
}

export interface TranscriptResult {
  segments: Array<{
    startSeconds: number;
    endSeconds: number;
    language: string;
    text: string;
    translation: string | null;
  }>;
}

export interface AiProvider {
  analyzeImage(input: { imagePath: string }): Promise<ImageAnalysisResult>;
  transcribeAudio(input: { audioPath: string }): Promise<TranscriptResult>;
}
```

- [ ] **Step 4: Implement deterministic mock provider**

Create `src/server/ai/mockProvider.ts`:

```ts
import path from 'node:path';
import type { AiProvider, ImageAnalysisResult, TranscriptResult } from './provider';

export function createMockAiProvider(): AiProvider {
  return {
    async analyzeImage(input: { imagePath: string }): Promise<ImageAnalysisResult> {
      const name = path.basename(input.imagePath).toLowerCase();
      if (name.includes('cut') || name.includes('cutting')) {
        return { tags: [{ displayName: '裁剪布料', confidence: 0.88 }, { displayName: '牛仔布', confidence: 0.82 }] };
      }
      if (name.includes('sewing')) {
        return { tags: [{ displayName: '缝纫机', confidence: 0.9 }, { displayName: '人物', confidence: 0.7 }] };
      }
      return { tags: [{ displayName: '素材', confidence: 0.5 }] };
    },

    async transcribeAudio(input: { audioPath: string }): Promise<TranscriptResult> {
      const name = path.basename(input.audioPath).toLowerCase();
      if (name.includes('ru')) {
        return {
          segments: [
            {
              startSeconds: 0,
              endSeconds: 4,
              language: 'ru',
              text: 'Пример разговора о ткани',
              translation: '关于面料的示例谈话'
            }
          ]
        };
      }
      return {
        segments: [
          {
            startSeconds: 0,
            endSeconds: 5,
            language: 'zh',
            text: '这块面料先按版型裁开',
            translation: null
          }
        ]
      };
    }
  };
}
```

- [ ] **Step 5: Add OpenAI-compatible provider boundary**

Create `src/server/ai/openAiCompatibleProvider.ts`:

```ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AiProvider, ImageAnalysisResult, TranscriptResult } from './provider';

export interface OpenAiCompatibleProviderConfig {
  baseUrl: string;
  apiKey: string;
  visionModel: string;
  transcribeModel: string;
}

function requireConfigured(value: string, name: string): string {
  if (!value) throw new Error(`${name} is required for OpenAI-compatible AI provider`);
  return value;
}

export function createOpenAiCompatibleProvider(config: OpenAiCompatibleProviderConfig): AiProvider {
  const baseUrl = requireConfigured(config.baseUrl, 'AI_OPENAI_BASE_URL').replace(/\/$/, '');
  const apiKey = requireConfigured(config.apiKey, 'AI_OPENAI_API_KEY');
  const visionModel = requireConfigured(config.visionModel, 'AI_OPENAI_VISION_MODEL');
  const transcribeModel = requireConfigured(config.transcribeModel, 'AI_OPENAI_TRANSCRIBE_MODEL');

  return {
    async analyzeImage(input: { imagePath: string }): Promise<ImageAnalysisResult> {
      const image = await readFile(input.imagePath);
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: visionModel,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Return JSON only: {"tags":[{"displayName":"标签","confidence":0.0}]}. Use concise Chinese tags for visible objects, scenes, and actions.' },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/${path.extname(input.imagePath).slice(1) || 'jpeg'};base64,${image.toString('base64')}`
                  }
                }
              ]
            }
          ],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`Vision request failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content ?? '{"tags":[]}';
      const parsed = JSON.parse(content) as ImageAnalysisResult;
      return { tags: parsed.tags ?? [] };
    },

    async transcribeAudio(input: { audioPath: string }): Promise<TranscriptResult> {
      const form = new FormData();
      form.append('model', transcribeModel);
      form.append('file', new Blob([await readFile(input.audioPath)]), path.basename(input.audioPath));

      const response = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`
        },
        body: form
      });

      if (!response.ok) {
        throw new Error(`Transcription request failed with HTTP ${response.status}`);
      }

      const payload = (await response.json()) as { text?: string; language?: string };
      return {
        segments: [
          {
            startSeconds: 0,
            endSeconds: 0,
            language: payload.language ?? 'unknown',
            text: payload.text ?? '',
            translation: null
          }
        ]
      };
    }
  };
}
```

- [ ] **Step 6: Run AI provider tests**

Run:

```bash
npm test -- src/server/tests/analysisPipeline.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit AI provider boundary**

```bash
git add src/server/ai src/server/tests/analysisPipeline.test.ts
git commit -m "feat: add AI provider abstraction"
```

---

### Task 8: Analysis Pipeline And Job Runner

**Files:**
- Create: `src/server/jobs/analysisPipeline.ts`
- Create: `src/server/jobs/jobRunner.ts`
- Create: `src/server/tests/jobRunner.test.ts`
- Modify: `src/server/tests/analysisPipeline.test.ts`

- [ ] **Step 1: Add failing job runner tests**

Create `src/server/tests/jobRunner.test.ts`:

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createMockAiProvider } from '../ai/mockProvider';
import { openDatabase } from '../db/connection';
import { createRepositories } from '../db/repositories';
import { processNextJob } from '../jobs/jobRunner';

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('processNextJob', () => {
  it('processes mock AI vision jobs and stores tags', async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-job-'));
    const db = openDatabase(path.join(tempDir, 'library.sqlite'));
    const repos = createRepositories(db);
    const source = repos.sources.upsertSource({ name: 'Factory', rootPath: tempDir });
    const imagePath = path.join(tempDir, 'factory_cutting.jpg');
    writeFileSync(imagePath, 'fake image');
    const asset = repos.assets.upsertAsset({
      sourceId: source.id,
      path: imagePath,
      fileName: 'factory_cutting.jpg',
      kind: 'image',
      extension: '.jpg',
      sizeBytes: 10,
      hash: 'image-hash',
      modifiedAt: '2026-05-25T00:00:00.000Z'
    });
    repos.jobs.ensureJobs(asset.id, ['ai_vision']);

    const processed = await processNextJob({
      repos,
      aiProvider: createMockAiProvider(),
      dataDir: tempDir,
      frameMode: 'balanced'
    });

    expect(processed).toBe(true);
    expect(repos.assets.searchAssets({ tagNames: ['裁剪布料'] })).toHaveLength(1);
    expect(repos.jobs.summary().done).toBe(1);
    db.close();
  });
});
```

- [ ] **Step 2: Run job runner test to verify it fails**

Run:

```bash
npm test -- src/server/tests/jobRunner.test.ts
```

Expected: FAIL because `../jobs/jobRunner` does not exist.

- [ ] **Step 3: Implement analysis pipeline**

Create `src/server/jobs/analysisPipeline.ts`:

```ts
import path from 'node:path';
import type { AiProvider } from '../ai/provider';
import type { createRepositories } from '../db/repositories';
import { extractVideoFrames, probeMedia } from '../media/ffmpeg';
import type { AnalysisJob } from '../../shared/types';

type Repositories = ReturnType<typeof createRepositories>;

export interface AnalysisContext {
  repos: Repositories;
  aiProvider: AiProvider;
  dataDir: string;
  frameMode: 'balanced' | 'precision';
}

export async function processAnalysisJob(job: AnalysisJob, context: AnalysisContext): Promise<void> {
  const asset = context.repos.assets.getById(job.assetId);
  if (!asset) throw new Error(`Asset not found for job ${job.id}`);

  if (job.stage === 'metadata') {
    if (asset.kind === 'video' || asset.kind === 'audio') {
      const metadata = await probeMedia(asset.path);
      context.repos.assets.setMetadata(asset.id, { ...metadata, status: 'partial' });
    } else {
      context.repos.assets.setMetadata(asset.id, { status: 'partial' });
    }
    return;
  }

  if (job.stage === 'frames') {
    if (asset.kind !== 'video') {
      context.repos.jobs.updateStatus(job.id, 'skipped', null);
      return;
    }
    const durationSeconds = asset.durationSeconds ?? 0;
    const outputDir = path.join(context.dataDir, 'frames', asset.id);
    const frames = await extractVideoFrames({
      filePath: asset.path,
      assetId: asset.id,
      durationSeconds,
      outputDir,
      mode: context.frameMode
    });
    context.repos.frames.replaceFrames(
      asset.id,
      frames.map((frame) => ({
        timestampSeconds: frame.timestampSeconds,
        thumbnailPath: frame.thumbnailPath,
        strategy: context.frameMode === 'precision' ? 'precision' : 'interval'
      }))
    );
    context.repos.assets.setMetadata(asset.id, {
      thumbnailPath: frames[0]?.thumbnailPath ?? asset.thumbnailPath,
      status: 'partial'
    });
    return;
  }

  if (job.stage === 'thumbnail') {
    context.repos.assets.setMetadata(asset.id, { thumbnailPath: asset.thumbnailPath ?? asset.path, status: 'partial' });
    return;
  }

  if (job.stage === 'audio') {
    context.repos.assets.setMetadata(asset.id, { status: 'partial' });
    return;
  }

  if (job.stage === 'ai_vision') {
    const imagePath = asset.thumbnailPath ?? asset.path;
    const result = await context.aiProvider.analyzeImage({ imagePath });
    for (const tag of result.tags) {
      context.repos.tags.assignAssetTag(asset.id, tag.displayName, 'ai', tag.confidence);
    }
    context.repos.assets.setMetadata(asset.id, { status: 'partial' });
    return;
  }

  if (job.stage === 'ai_transcript') {
    const result = await context.aiProvider.transcribeAudio({ audioPath: asset.path });
    context.repos.transcripts.replaceSegments(asset.id, result.segments);
    context.repos.assets.setMetadata(asset.id, { status: 'partial' });
  }
}
```

- [ ] **Step 4: Implement job runner**

Create `src/server/jobs/jobRunner.ts`:

```ts
import type { AnalysisContext } from './analysisPipeline';
import { processAnalysisJob } from './analysisPipeline';

export async function processNextJob(context: AnalysisContext): Promise<boolean> {
  const job = context.repos.jobs.nextPending();
  if (!job) return false;

  context.repos.jobs.updateStatus(job.id, 'processing');

  try {
    await processAnalysisJob(job, context);
    const freshAsset = context.repos.assets.getById(job.assetId);
    context.repos.jobs.updateStatus(job.id, 'done');

    const remaining = context.repos.jobs
      .listForAsset(job.assetId)
      .filter((item) => !['done', 'skipped'].includes(item.status));
    if (freshAsset && remaining.length === 0) {
      context.repos.assets.setMetadata(freshAsset.id, { status: 'done' });
    }

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    context.repos.jobs.updateStatus(job.id, 'failed', message);
    context.repos.assets.setMetadata(job.assetId, { status: 'failed' });
    return true;
  }
}

export async function drainQueue(context: AnalysisContext, limit = 25): Promise<number> {
  let processed = 0;
  while (processed < limit) {
    const didProcess = await processNextJob(context);
    if (!didProcess) break;
    processed += 1;
  }
  return processed;
}
```

- [ ] **Step 5: Run job tests**

Run:

```bash
npm test -- src/server/tests/jobRunner.test.ts src/server/tests/analysisPipeline.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit job pipeline**

```bash
git add src/server/jobs src/server/tests/jobRunner.test.ts src/server/tests/analysisPipeline.test.ts
git commit -m "feat: add resumable analysis job runner"
```

---

### Task 9: Local API Server

**Files:**
- Create: `src/server/config.ts`
- Create: `src/server/api/routes.ts`
- Create: `src/server/app.ts`
- Create: `src/server/index.ts`
- Create: `src/server/tests/api.test.ts`

- [ ] **Step 1: Write failing API tests**

Create `src/server/tests/api.test.ts`:

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';

let tempDir: string | null = null;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe('API', () => {
  it('imports a source, lists assets, runs jobs, and returns details', async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'ai-media-api-'));
    const sourceDir = path.join(tempDir, 'factory');
    await import('node:fs').then(({ mkdirSync }) => mkdirSync(sourceDir));
    writeFileSync(path.join(sourceDir, 'factory_cutting.jpg'), 'fake image');

    const app = createApp({ dataDir: tempDir, aiProviderName: 'mock' });

    const importResponse = await request(app)
      .post('/api/sources/import')
      .send({ rootPath: sourceDir, name: 'Factory' })
      .expect(200);
    expect(importResponse.body.indexed).toBe(1);

    await request(app).post('/api/jobs/drain').send({ limit: 5 }).expect(200);

    const assetsResponse = await request(app).get('/api/assets?tag=裁剪布料').expect(200);
    expect(assetsResponse.body.assets).toHaveLength(1);

    const detailResponse = await request(app).get(`/api/assets/${assetsResponse.body.assets[0].id}`).expect(200);
    expect(detailResponse.body.asset.fileName).toBe('factory_cutting.jpg');
    expect(detailResponse.body.tags[0].displayName).toBe('裁剪布料');
  });
});
```

- [ ] **Step 2: Run API test to verify it fails**

Run:

```bash
npm test -- src/server/tests/api.test.ts
```

Expected: FAIL because `../app` does not exist.

- [ ] **Step 3: Implement config**

Create `src/server/config.ts`:

```ts
import 'dotenv/config';
import path from 'node:path';

export interface AppConfig {
  dataDir: string;
  port: number;
  aiProviderName: 'mock' | 'openai-compatible';
  openAiBaseUrl: string;
  openAiApiKey: string;
  openAiVisionModel: string;
  openAiTranscribeModel: string;
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    dataDir: overrides.dataDir ?? path.resolve(process.env.AI_MEDIA_DATA_DIR ?? '.data'),
    port: overrides.port ?? Number(process.env.AI_MEDIA_PORT ?? 8787),
    aiProviderName: overrides.aiProviderName ?? ((process.env.AI_PROVIDER as AppConfig['aiProviderName']) || 'mock'),
    openAiBaseUrl: overrides.openAiBaseUrl ?? process.env.AI_OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    openAiApiKey: overrides.openAiApiKey ?? process.env.AI_OPENAI_API_KEY ?? '',
    openAiVisionModel: overrides.openAiVisionModel ?? process.env.AI_OPENAI_VISION_MODEL ?? '',
    openAiTranscribeModel: overrides.openAiTranscribeModel ?? process.env.AI_OPENAI_TRANSCRIBE_MODEL ?? ''
  };
}
```

- [ ] **Step 4: Implement routes**

Create `src/server/api/routes.ts`:

```ts
import { Router } from 'express';
import { z } from 'zod';
import type { AiProvider } from '../ai/provider';
import type { createRepositories } from '../db/repositories';
import { drainQueue } from '../jobs/jobRunner';
import { importSourceDirectory } from '../scanner/scanner';

type Repositories = ReturnType<typeof createRepositories>;

export function createApiRouter(input: {
  repos: Repositories;
  aiProvider: AiProvider;
  dataDir: string;
}): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  router.get('/sources', (_req, res) => {
    res.json({ sources: input.repos.sources.list() });
  });

  router.post('/sources/import', async (req, res, next) => {
    try {
      const body = z.object({ rootPath: z.string().min(1), name: z.string().min(1) }).parse(req.body);
      const result = await importSourceDirectory(input.repos, body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/assets', (req, res) => {
    const tagQuery = req.query.tag;
    const tagNames = Array.isArray(tagQuery)
      ? tagQuery.map(String)
      : tagQuery
        ? [String(tagQuery)]
        : undefined;
    const query = req.query.q ? String(req.query.q) : undefined;
    const transcript = req.query.transcript ? String(req.query.transcript) : undefined;
    res.json({ assets: input.repos.assets.searchAssets({ tagNames, query, transcript }) });
  });

  router.get('/assets/:id', (req, res) => {
    const asset = input.repos.assets.getById(req.params.id);
    if (!asset) {
      res.status(404).json({ error: 'Asset not found' });
      return;
    }
    const tags = input.repos.assets.searchAssets({}).some((item) => item.id === asset.id)
      ? []
      : [];
    res.json({
      asset,
      tags,
      frames: input.repos.frames.listForAsset(asset.id),
      transcripts: input.repos.transcripts.listForAsset(asset.id),
      jobs: input.repos.jobs.listForAsset(asset.id)
    });
  });

  router.get('/queue', (_req, res) => {
    res.json({ summary: input.repos.jobs.summary() });
  });

  router.post('/jobs/drain', async (req, res, next) => {
    try {
      const body = z.object({ limit: z.number().int().min(1).max(100).default(25) }).parse(req.body ?? {});
      const processed = await drainQueue({
        repos: input.repos,
        aiProvider: input.aiProvider,
        dataDir: input.dataDir,
        frameMode: 'balanced'
      }, body.limit);
      res.json({ processed, summary: input.repos.jobs.summary() });
    } catch (error) {
      next(error);
    }
  });

  router.post('/jobs/retry-failed', (req, res) => {
    const parsed = z.object({ assetId: z.string().optional() }).parse(req.body ?? {});
    const changed = input.repos.jobs.retryFailed(parsed.assetId);
    res.json({ changed, summary: input.repos.jobs.summary() });
  });

  return router;
}
```

- [ ] **Step 5: Add repository helpers for asset detail tags**

Modify `src/server/db/repositories.ts` by adding this method inside the returned `tags` object:

```ts
    listForAsset(assetId: string): Array<{ displayName: string; confidence: number | null; source: TagSource }> {
      return db
        .prepare(
          `select t.display_name as displayName, t.source as source, at.confidence as confidence
           from asset_tags at
           join tags t on t.id = at.tag_id
           where at.target_type = 'asset' and at.target_id = ?
           order by coalesce(at.confidence, 0) desc, t.display_name asc`
        )
        .all(assetId)
        .map((row) => ({
          displayName: String((row as Record<string, unknown>).displayName),
          source: (row as Record<string, unknown>).source as TagSource,
          confidence:
            (row as Record<string, unknown>).confidence === null
              ? null
              : Number((row as Record<string, unknown>).confidence)
        }));
    }
```

Modify the `GET /assets/:id` route in `src/server/api/routes.ts` so the response uses:

```ts
    res.json({
      asset,
      tags: input.repos.tags.listForAsset(asset.id),
      frames: input.repos.frames.listForAsset(asset.id),
      transcripts: input.repos.transcripts.listForAsset(asset.id),
      jobs: input.repos.jobs.listForAsset(asset.id)
    });
```

- [ ] **Step 6: Implement app and server entry**

Create `src/server/app.ts`:

```ts
import cors from 'cors';
import express from 'express';
import path from 'node:path';
import { createMockAiProvider } from './ai/mockProvider';
import { createOpenAiCompatibleProvider } from './ai/openAiCompatibleProvider';
import { createApiRouter } from './api/routes';
import { loadConfig, type AppConfig } from './config';
import { openDatabase } from './db/connection';
import { createRepositories } from './db/repositories';

export function createApp(overrides: Partial<AppConfig> = {}) {
  const config = loadConfig(overrides);
  const db = openDatabase(path.join(config.dataDir, 'library.sqlite'));
  const repos = createRepositories(db);
  const aiProvider =
    config.aiProviderName === 'openai-compatible'
      ? createOpenAiCompatibleProvider({
          baseUrl: config.openAiBaseUrl,
          apiKey: config.openAiApiKey,
          visionModel: config.openAiVisionModel,
          transcribeModel: config.openAiTranscribeModel
        })
      : createMockAiProvider();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', createApiRouter({ repos, aiProvider, dataDir: config.dataDir }));
  app.use('/media', express.static(config.dataDir));
  app.use(express.static(path.resolve('dist/client')));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: message });
  });
  return app;
}
```

Create `src/server/index.ts`:

```ts
import { createApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const app = createApp(config);

app.listen(config.port, '127.0.0.1', () => {
  console.log(`AI media library API listening at http://127.0.0.1:${config.port}`);
});
```

- [ ] **Step 7: Run API tests**

Run:

```bash
npm test -- src/server/tests/api.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit API server**

```bash
git add src/server/config.ts src/server/api src/server/app.ts src/server/index.ts src/server/db/repositories.ts src/server/tests/api.test.ts
git commit -m "feat: add local media library API"
```

---

### Task 10: React Client API And Main Layout

**Files:**
- Create: `src/client/main.tsx`
- Create: `src/client/index.html`
- Create: `src/client/App.tsx`
- Create: `src/client/api.ts`
- Create: `src/client/styles.css`
- Create: `src/client/components/Sidebar.tsx`
- Create: `src/client/components/QueueSummary.tsx`
- Create: `src/client/components/FilterBar.tsx`
- Create: `src/client/components/AssetGrid.tsx`
- Create: `src/client/components/AssetDetail.tsx`

- [ ] **Step 1: Create API client**

Create `src/client/api.ts`:

```ts
import type { Asset, AnalysisJob, LibrarySource, QueueSummary, TranscriptSegment, VideoFrame } from '../shared/types';

export interface AssetDetailResponse {
  asset: Asset;
  tags: Array<{ displayName: string; confidence: number | null; source: string }>;
  frames: VideoFrame[];
  transcripts: TranscriptSegment[];
  jobs: AnalysisJob[];
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: response.statusText }))) as { error?: string };
    throw new Error(payload.error ?? response.statusText);
  }
  return response.json() as Promise<T>;
}

export const api = {
  listSources: () => requestJson<{ sources: LibrarySource[] }>('/api/sources'),
  listAssets: (filters: { tags: string[]; query: string }) => {
    const params = new URLSearchParams();
    for (const tag of filters.tags) params.append('tag', tag);
    if (filters.query) params.set('q', filters.query);
    return requestJson<{ assets: Asset[] }>(`/api/assets?${params.toString()}`);
  },
  getAssetDetail: (id: string) => requestJson<AssetDetailResponse>(`/api/assets/${id}`),
  getQueue: () => requestJson<{ summary: QueueSummary }>('/api/queue'),
  importSource: (input: { rootPath: string; name: string }) =>
    requestJson<{ sourceId: string; indexed: number; skipped: number }>('/api/sources/import', {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  drainJobs: (limit: number) =>
    requestJson<{ processed: number; summary: QueueSummary }>('/api/jobs/drain', {
      method: 'POST',
      body: JSON.stringify({ limit })
    }),
  retryFailedJobs: (assetId?: string) =>
    requestJson<{ changed: number; summary: QueueSummary }>('/api/jobs/retry-failed', {
      method: 'POST',
      body: JSON.stringify(assetId ? { assetId } : {})
    })
};
```

- [ ] **Step 2: Create React entry point and layout**

Create `src/client/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `src/client/App.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react';
import type { Asset, LibrarySource, QueueSummary } from '../shared/types';
import { api, type AssetDetailResponse } from './api';
import { AssetDetail } from './components/AssetDetail';
import { AssetGrid } from './components/AssetGrid';
import { FilterBar } from './components/FilterBar';
import { QueueSummaryPanel } from './components/QueueSummary';
import { Sidebar } from './components/Sidebar';

const starterTags = ['裁剪布料', '缝纫机', '牛仔布', '人物', '产品册', '中文', '英文', '俄文'];

export function App() {
  const [sources, setSources] = useState<LibrarySource[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AssetDetailResponse | null>(null);
  const [queue, setQueue] = useState<QueueSummary | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [importPath, setImportPath] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    const [sourcesResponse, assetsResponse, queueResponse] = await Promise.all([
      api.listSources(),
      api.listAssets({ tags: selectedTags, query }),
      api.getQueue()
    ]);
    setSources(sourcesResponse.sources);
    setAssets(assetsResponse.assets);
    setQueue(queueResponse.summary);
  }

  useEffect(() => {
    void refresh().catch((error) => setMessage(error.message));
  }, [selectedTags.join('|'), query]);

  useEffect(() => {
    if (!selectedAssetId) {
      setDetail(null);
      return;
    }
    void api.getAssetDetail(selectedAssetId).then(setDetail).catch((error) => setMessage(error.message));
  }, [selectedAssetId]);

  const activeAssetId = useMemo(() => selectedAssetId ?? assets[0]?.id ?? null, [assets, selectedAssetId]);

  useEffect(() => {
    if (!selectedAssetId && activeAssetId) setSelectedAssetId(activeAssetId);
  }, [activeAssetId, selectedAssetId]);

  async function importSource() {
    if (!importPath.trim()) return;
    const name = importPath.split('/').filter(Boolean).at(-1) ?? 'Imported Source';
    const result = await api.importSource({ rootPath: importPath.trim(), name });
    setMessage(`导入完成：${result.indexed} 个素材，跳过 ${result.skipped} 个文件`);
    setImportPath('');
    await refresh();
  }

  async function drainQueue() {
    const result = await api.drainJobs(10);
    setQueue(result.summary);
    setMessage(`已处理 ${result.processed} 个任务`);
    await refresh();
  }

  async function retryFailedJobs() {
    const result = await api.retryFailedJobs();
    setQueue(result.summary);
    setMessage(`已重新排队 ${result.changed} 个失败任务`);
    await refresh();
  }

  return (
    <div className="app-shell">
      <Sidebar sources={sources} importPath={importPath} setImportPath={setImportPath} onImport={importSource} />
      <main className="workspace">
        <header className="topbar">
          <input
            className="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索文件名、路径或素材关键词"
          />
          <div className="topbar-actions">
            <button className="secondary" onClick={retryFailedJobs}>重试失败</button>
            <button className="primary" onClick={drainQueue}>处理 10 个任务</button>
          </div>
        </header>
        <FilterBar tags={starterTags} selectedTags={selectedTags} onChange={setSelectedTags} />
        {message ? <div className="notice">{message}</div> : null}
        <AssetGrid assets={assets} selectedAssetId={selectedAssetId} onSelect={setSelectedAssetId} />
      </main>
      <aside className="detail-panel">
        <QueueSummaryPanel summary={queue} />
        <AssetDetail detail={detail} />
      </aside>
    </div>
  );
}
```

- [ ] **Step 3: Create UI components**

Create `src/client/components/Sidebar.tsx`:

```tsx
import type { LibrarySource } from '../../shared/types';

export function Sidebar(props: {
  sources: LibrarySource[];
  importPath: string;
  setImportPath: (value: string) => void;
  onImport: () => void;
}) {
  return (
    <aside className="sidebar">
      <h1>AI 素材库</h1>
      <section>
        <h2>主题</h2>
        <button className="nav-item active">牛仔面料工厂</button>
        <button className="nav-item">未归类</button>
      </section>
      <section>
        <h2>导入来源</h2>
        {props.sources.map((source) => (
          <div className="source-item" key={source.id}>{source.name}</div>
        ))}
      </section>
      <section>
        <h2>导入目录</h2>
        <input
          className="path-input"
          value={props.importPath}
          onChange={(event) => props.setImportPath(event.target.value)}
          placeholder="/Volumes/素材/牛仔面料工厂"
        />
        <button className="primary full" onClick={props.onImport}>导入</button>
      </section>
    </aside>
  );
}
```

Create `src/client/components/QueueSummary.tsx`:

```tsx
import type { QueueSummary } from '../../shared/types';

export function QueueSummaryPanel({ summary }: { summary: QueueSummary | null }) {
  if (!summary) return <div className="queue-card">队列加载中</div>;
  return (
    <div className="queue-card">
      <h2>后台解析队列</h2>
      <div className="queue-grid">
        <span>等待 {summary.pending}</span>
        <span>处理中 {summary.processing}</span>
        <span>部分完成 {summary.partial}</span>
        <span>完成 {summary.done}</span>
        <span>失败 {summary.failed}</span>
        <span>跳过 {summary.skipped}</span>
      </div>
    </div>
  );
}
```

Create `src/client/components/FilterBar.tsx`:

```tsx
export function FilterBar(props: {
  tags: string[];
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}) {
  function toggle(tag: string) {
    props.onChange(
      props.selectedTags.includes(tag)
        ? props.selectedTags.filter((item) => item !== tag)
        : [...props.selectedTags, tag]
    );
  }

  return (
    <div className="filter-bar">
      {props.tags.map((tag) => (
        <button
          key={tag}
          className={props.selectedTags.includes(tag) ? 'chip active' : 'chip'}
          onClick={() => toggle(tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
```

Create `src/client/components/AssetGrid.tsx`:

```tsx
import type { Asset } from '../../shared/types';

function formatStatus(status: Asset['status']) {
  const labels: Record<Asset['status'], string> = {
    pending: '等待',
    processing: '处理中',
    partial: '部分完成',
    done: '完成',
    failed: '失败',
    skipped: '跳过'
  };
  return labels[status];
}

export function AssetGrid(props: {
  assets: Asset[];
  selectedAssetId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!props.assets.length) {
    return <div className="empty">导入素材目录后，这里会显示素材墙。</div>;
  }

  return (
    <section className="asset-grid">
      {props.assets.map((asset) => (
        <button
          key={asset.id}
          className={props.selectedAssetId === asset.id ? 'asset-card selected' : 'asset-card'}
          onClick={() => props.onSelect(asset.id)}
        >
          <div className={`thumb ${asset.kind}`}>{asset.kind}</div>
          <div className="asset-body">
            <strong>{asset.fileName}</strong>
            <span>{formatStatus(asset.status)}</span>
          </div>
        </button>
      ))}
    </section>
  );
}
```

Create `src/client/components/AssetDetail.tsx`:

```tsx
import type { AssetDetailResponse } from '../api';

function timeLabel(seconds: number) {
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60).toString().padStart(2, '0');
  const rest = (whole % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

export function AssetDetail({ detail }: { detail: AssetDetailResponse | null }) {
  if (!detail) return <div className="detail-empty">选择一条素材查看详情。</div>;

  return (
    <div className="detail">
      <h2>{detail.asset.fileName}</h2>
      <div className="meta-line">{detail.asset.kind} · {detail.asset.extension} · {detail.asset.status}</div>

      <div className="tag-list">
        {detail.tags.map((tag) => (
          <span key={tag.displayName} className="tag">{tag.displayName}</span>
        ))}
      </div>

      <h3>视频帧</h3>
      <div className="frame-list">
        {detail.frames.map((frame) => (
          <div className="frame" key={frame.id}>
            <span>{timeLabel(frame.timestampSeconds)}</span>
          </div>
        ))}
      </div>

      <h3>字幕片段</h3>
      <div className="transcripts">
        {detail.transcripts.map((segment) => (
          <p key={segment.id}>
            <strong>{timeLabel(segment.startSeconds)} - {timeLabel(segment.endSeconds)}</strong>
            <br />
            {segment.text}
          </p>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create styles**

Create `src/client/styles.css`:

```css
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f4f6f8;
  color: #172033;
}
button, input { font: inherit; }
.app-shell {
  display: grid;
  grid-template-columns: 240px minmax(480px, 1fr) 360px;
  min-height: 100vh;
}
.sidebar {
  background: #f8fafc;
  border-right: 1px solid #dce4ef;
  padding: 18px;
}
.sidebar h1 { font-size: 22px; margin: 0 0 24px; }
.sidebar h2 { font-size: 12px; color: #68778d; text-transform: uppercase; margin: 22px 0 8px; }
.nav-item, .source-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 9px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #2e3a4f;
}
.nav-item.active { background: #e8f1ff; color: #0b55c4; font-weight: 700; }
.path-input, .search {
  width: 100%;
  border: 1px solid #cbd6e4;
  border-radius: 8px;
  padding: 10px 12px;
  background: white;
}
.primary, .secondary {
  border: 0;
  border-radius: 8px;
  padding: 10px 14px;
  font-weight: 700;
}
.primary { background: #1f6feb; color: white; }
.secondary { background: #eef4ff; color: #0b55c4; }
.full { width: 100%; margin-top: 8px; }
.workspace {
  min-width: 0;
  display: grid;
  grid-template-rows: auto auto auto 1fr;
}
.topbar {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #dce4ef;
  background: white;
}
.topbar-actions { display: flex; gap: 8px; }
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid #dce4ef;
  background: white;
}
.chip {
  border: 1px solid #cbd6e4;
  border-radius: 999px;
  padding: 7px 10px;
  background: white;
  color: #33445c;
}
.chip.active { border-color: #1f6feb; background: #e8f1ff; color: #0b55c4; }
.notice {
  margin: 12px 16px 0;
  border: 1px solid #e8c96f;
  background: #fff7dc;
  color: #4d3a00;
  border-radius: 8px;
  padding: 10px 12px;
}
.asset-grid {
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  overflow: auto;
}
.asset-card {
  border: 1px solid #dce4ef;
  background: white;
  border-radius: 8px;
  padding: 0;
  text-align: left;
  overflow: hidden;
}
.asset-card.selected { outline: 2px solid #1f6feb; }
.thumb {
  height: 104px;
  display: grid;
  place-items: center;
  color: white;
  text-transform: uppercase;
  background: linear-gradient(135deg, #7890a8, #a98b62);
}
.thumb.image { background: linear-gradient(135deg, #5e8f76, #b9a55d); }
.thumb.audio { background: linear-gradient(135deg, #6d5bb8, #348d9a); }
.asset-body { padding: 9px; display: grid; gap: 5px; }
.asset-body strong { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.asset-body span { color: #66758b; font-size: 13px; }
.detail-panel {
  border-left: 1px solid #dce4ef;
  background: #fbfcfe;
  padding: 16px;
  overflow: auto;
}
.queue-card, .detail-empty, .detail {
  border: 1px solid #dce4ef;
  border-radius: 8px;
  background: white;
  padding: 14px;
  margin-bottom: 14px;
}
.queue-card h2, .detail h2 { margin: 0 0 10px; font-size: 18px; }
.queue-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; color: #46566d; font-size: 13px; }
.meta-line { color: #65758c; margin-bottom: 10px; }
.tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
.tag { background: #eef4ff; color: #0b55c4; border-radius: 999px; padding: 5px 8px; font-size: 12px; }
.frame-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.frame {
  aspect-ratio: 16 / 9;
  border-radius: 6px;
  background: linear-gradient(135deg, #748da2, #a98b62);
  color: white;
  display: flex;
  align-items: end;
  padding: 6px;
  font-size: 12px;
}
.transcripts p { line-height: 1.5; color: #33445c; }
.empty { padding: 28px; color: #68778d; }
@media (max-width: 1100px) {
  .app-shell { grid-template-columns: 210px 1fr; }
  .detail-panel { display: none; }
}
```

- [ ] **Step 5: Add Vite HTML entry**

Create `src/client/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI 素材库</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Run typecheck and build**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands pass.

- [ ] **Step 7: Commit React client**

```bash
git add src/client
git commit -m "feat: add local media library UI"
```

---

### Task 11: Fixtures And End-To-End Smoke Test

**Files:**
- Create: `scripts/make-fixtures.ts`
- Create: `tests/e2e/smoke.spec.ts`
- Modify: `src/server/api/routes.ts`

- [ ] **Step 1: Create fixture generator**

Create `scripts/make-fixtures.ts`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve('.data', 'fixtures', 'factory');
mkdirSync(root, { recursive: true });
writeFileSync(path.join(root, 'factory_cutting.jpg'), 'mock image for cutting fabric');
writeFileSync(path.join(root, 'sewing_line.jpg'), 'mock image for sewing machine');
writeFileSync(path.join(root, 'worker_talk_ru.wav'), 'mock audio for russian talk');
writeFileSync(path.join(root, 'notes.txt'), 'ignored note');

console.log(root);
```

- [ ] **Step 2: Add fixture import shortcut for dev-only smoke testing**

Modify `src/server/api/routes.ts` by adding this route before the error handler:

```ts
  router.post('/dev/import-fixtures', async (_req, res, next) => {
    try {
      const rootPath = path.resolve('.data', 'fixtures', 'factory');
      const result = await importSourceDirectory(input.repos, { rootPath, name: '牛仔面料工厂' });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
```

Also add this import at the top of `src/server/api/routes.ts`:

```ts
import path from 'node:path';
```

- [ ] **Step 3: Write Playwright smoke test**

Create `tests/e2e/smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';

test('imports fixtures and filters AI-tagged assets', async ({ page, request }) => {
  execFileSync('npm', ['run', 'fixtures'], { stdio: 'inherit' });

  await request.post('/api/dev/import-fixtures');
  await request.post('/api/jobs/drain', { data: { limit: 20 } });

  await page.goto('/');
  await expect(page.getByText('AI 素材库')).toBeVisible();
  await expect(page.getByText('factory_cutting.jpg')).toBeVisible();

  await page.getByRole('button', { name: '裁剪布料' }).click();
  await expect(page.getByText('factory_cutting.jpg')).toBeVisible();
});
```

- [ ] **Step 4: Run E2E smoke test**

Run:

```bash
npm run test:e2e
```

Expected: PASS in Chromium. If Playwright browsers are missing, run `npx playwright install chromium`, then repeat `npm run test:e2e`.

- [ ] **Step 5: Commit fixtures and E2E**

```bash
git add scripts tests src/server/api/routes.ts
git commit -m "test: add media library smoke coverage"
```

---

### Task 12: Final Verification And README Notes

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README**

Create `README.md`:

```md
# AI Media Tools

Local-first AI-assisted media library for organizing mixed video, image, and audio素材.

## MVP Capabilities

- Import a local folder without moving or renaming original files.
- Index image, video, and audio files into SQLite.
- Queue resumable analysis jobs.
- Generate deterministic mock AI labels for local development.
- Browse assets, filter by tags, inspect asset details, and view queue status.

## Development

```bash
npm install
cp .env.example .env
npm run dev
```

In another terminal:

```bash
npm run dev:client
```

Open `http://127.0.0.1:5173`.

## Fixture Demo

```bash
npm run fixtures
curl -X POST http://127.0.0.1:8787/api/dev/import-fixtures
curl -X POST http://127.0.0.1:8787/api/jobs/drain -H 'content-type: application/json' -d '{"limit":20}'
```

## Verification

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Data Safety

The MVP indexes source files by path and metadata. It does not move, rename, or modify original media files.
```

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Expected: all commands pass.

- [ ] **Step 3: Inspect git status**

Run:

```bash
git status --short
```

Expected: only `README.md` is uncommitted.

- [ ] **Step 4: Commit README**

```bash
git add README.md
git commit -m "docs: add MVP usage notes"
```

---

## Plan Self-Review

Spec coverage:
- Local Web app: covered by Tasks 1, 9, 10, and 11.
- SQLite indexing: covered by Tasks 3 and 4.
- Incremental folder import: covered by Task 5. It upserts changed files and creates pending jobs.
- Default no original file mutation: covered by Task 5 scanner behavior and Task 12 README.
- Video frames and timing: covered by Task 6 and Task 8. Real ffmpeg extraction is behind `extractVideoFrames`.
- Image/video AI tags and transcripts: covered by Tasks 7 and 8 with deterministic mock provider and OpenAI-compatible boundary.
- Audio basic indexing: covered by Tasks 2 and 5 through audio classification and metadata jobs.
- Manual/AI themes: UI shows the first manual theme; full collection persistence is in the schema and repositories. Collection management screens are outside this MVP.
- Search/filter by tags/query/transcript: covered by Tasks 4, 9, and 10.
- Job pause/resume/retry: persistent statuses are covered by Tasks 3, 4, and 8. Manual retry endpoints are not included in this MVP and should be the first follow-up after the vertical slice.
- Error handling: job failures are persisted in Task 8; API errors return JSON in Task 9.
- Privacy/cost: provider boundary uploads derived images/audio only; explicit cost UI is outside this MVP and should be added when a real cloud provider is enabled.

Placeholder scan:
- The plan avoids empty placeholder sections and gives concrete file paths, commands, test expectations, and code snippets.

Type consistency:
- Shared types are introduced in Task 2.
- Repository methods used by later tasks are introduced before use, except `tags.listForAsset`, which is added explicitly in Task 9 before API detail responses depend on it.
- API response types used by the client match the route payloads from Task 9.

Implementation risk notes:
- `better-sqlite3` may require native build tooling on a fresh machine. If install fails, switch to a pure JS SQLite package in Task 1 and update `connection.ts` accordingly before continuing.
- The OpenAI-compatible provider is a boundary implementation. Before enabling it against a real provider, verify the provider's current request format and model names from official docs.
- The generated fixture media files are text files with media extensions. They are intentionally valid for scanner and mock AI tests, but not valid for real ffmpeg frame extraction. Use real sample media before testing Task 6 against ffmpeg.
