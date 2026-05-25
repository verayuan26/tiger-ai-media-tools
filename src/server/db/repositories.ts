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
import { JOB_STAGES } from '../../shared/constants';

type Row = Record<string, unknown>;

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

interface MetadataInput {
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  thumbnailPath?: string | null;
  status?: JobStatus;
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

interface AssetTagInput {
  displayName: string;
  confidence: number | null;
}

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeTagName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function mapSource(row: Row): LibrarySource {
  return {
    id: String(row.id),
    name: String(row.name),
    rootPath: String(row.root_path),
    incrementalScanEnabled: Boolean(row.incremental_scan_enabled),
    lastScannedAt: row.last_scanned_at === null ? null : String(row.last_scanned_at),
    createdAt: String(row.created_at)
  };
}

function mapAsset(row: Row): Asset {
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

function mapJob(row: Row): AnalysisJob {
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

function mapFrame(row: Row): VideoFrame {
  return {
    id: String(row.id),
    assetId: String(row.asset_id),
    timestampSeconds: Number(row.timestamp_seconds),
    thumbnailPath: String(row.thumbnail_path),
    strategy: row.strategy as VideoFrame['strategy']
  };
}

function mapTranscript(row: Row): TranscriptSegment {
  return {
    id: String(row.id),
    assetId: String(row.asset_id),
    startSeconds: Number(row.start_seconds),
    endSeconds: Number(row.end_seconds),
    language: String(row.language),
    text: String(row.text),
    translation: row.translation === null ? null : String(row.translation)
  };
}

export function createRepositories(db: LibraryDatabase) {
  const sources = {
    upsertSource(input: SourceInput): LibrarySource {
      const existing = db.prepare('select * from library_sources where root_path = ?').get(input.rootPath) as
        | Row
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
      const row = db.prepare('select * from library_sources where id = ?').get(id) as Row | undefined;
      return row ? mapSource(row) : null;
    },

    list(): LibrarySource[] {
      return db
        .prepare('select * from library_sources order by created_at desc')
        .all()
        .map((row) => mapSource(row as Row));
    },

    markScanned(id: string): void {
      db.prepare('update library_sources set last_scanned_at = ? where id = ?').run(nowIso(), id);
    }
  };

  const assets = {
    upsertAsset(input: AssetInput): Asset {
      const existing = db.prepare('select * from assets where path = ?').get(input.path) as Row | undefined;
      const timestamp = nowIso();

      if (existing) {
        db.prepare(
          `update assets
           set source_id = ?,
               file_name = ?,
               kind = ?,
               extension = ?,
               size_bytes = ?,
               hash = ?,
               modified_at = ?,
               status = 'pending',
               updated_at = ?
           where id = ?`
        ).run(
          input.sourceId,
          input.fileName,
          input.kind,
          input.extension,
          input.sizeBytes,
          input.hash,
          input.modifiedAt,
          timestamp,
          existing.id
        );
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
      const row = db.prepare('select * from assets where id = ?').get(id) as Row | undefined;
      return row ? mapAsset(row) : null;
    },

    getByPath(filePath: string): Asset | null {
      const row = db.prepare('select * from assets where path = ?').get(filePath) as Row | undefined;
      return row ? mapAsset(row) : null;
    },

    touchModifiedAt(id: string, modifiedAt: string): void {
      db.prepare('update assets set modified_at = ?, updated_at = ? where id = ?').run(modifiedAt, nowIso(), id);
    },

    clearDerivedData(id: string): void {
      const clear = db.transaction(() => {
        db.prepare(
          `update assets
           set duration_seconds = null,
               width = null,
               height = null,
               thumbnail_path = null,
               updated_at = ?
           where id = ?`
        ).run(nowIso(), id);
        db.prepare('delete from video_frames where asset_id = ?').run(id);
        db.prepare('delete from transcript_segments where asset_id = ?').run(id);
      });

      clear();
    },

    refreshChangedAsset(input: AssetInput, stages: JobStage[]): Asset {
      const refresh = db.transaction(() => {
        const asset = assets.upsertAsset(input);
        assets.clearDerivedData(asset.id);
        tags.clearGeneratedForAsset(asset.id);
        jobs.resetJobs(asset.id, stages);
        return assets.getById(asset.id) as Asset;
      });

      return refresh();
    },

    setMetadata(id: string, metadata: MetadataInput): void {
      const current = assets.getById(id);
      if (!current) return;

      db.prepare(
        `update assets
         set duration_seconds = ?,
             width = ?,
             height = ?,
             thumbnail_path = ?,
             status = ?,
             updated_at = ?
         where id = ?`
      ).run(
        metadata.durationSeconds !== undefined ? metadata.durationSeconds : current.durationSeconds,
        metadata.width !== undefined ? metadata.width : current.width,
        metadata.height !== undefined ? metadata.height : current.height,
        metadata.thumbnailPath !== undefined ? metadata.thumbnailPath : current.thumbnailPath,
        metadata.status !== undefined ? metadata.status : current.status,
        nowIso(),
        id
      );
    },

    listBySource(sourceId: string): Asset[] {
      return db
        .prepare('select * from assets where source_id = ? order by file_name')
        .all(sourceId)
        .map((row) => mapAsset(row as Row));
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
            where at.target_id = a.id
              and at.target_type = 'asset'
              and t.normalized_name = ?
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
        .map((row) => mapAsset(row as Row));
    }
  };

  const jobs = {
    ensureJobs(assetId: string, stages: JobStage[]): AnalysisJob[] {
      const timestamp = nowIso();
      const insert = db.prepare(
        `insert or ignore into analysis_jobs
          (id, asset_id, stage, status, attempts, error_message, created_at, updated_at)
         values (?, ?, ?, 'pending', 0, null, ?, ?)`
      );

      for (const stage of stages) {
        insert.run(createId('job'), assetId, stage, timestamp, timestamp);
      }

      return jobs.listForAsset(assetId);
    },

    resetJobs(assetId: string, stages: JobStage[]): AnalysisJob[] {
      if (stages.length === 0) return [];
      for (const stage of stages) {
        if (!(JOB_STAGES as readonly string[]).includes(stage)) {
          throw new Error(`Unsupported job stage: ${stage}`);
        }
      }

      const timestamp = nowIso();
      const reset = db.transaction(() => {
        jobs.ensureJobs(assetId, stages);
        db.prepare(
          `update analysis_jobs
           set status = 'pending',
               attempts = 0,
               error_message = null,
               updated_at = ?
           where asset_id = ?
             and stage in (${stages.map(() => '?').join(', ')})`
        ).run(timestamp, assetId, ...stages);
      });

      reset();
      return jobs.listForAsset(assetId).filter((job) => stages.includes(job.stage));
    },

    listForAsset(assetId: string): AnalysisJob[] {
      return db
        .prepare('select * from analysis_jobs where asset_id = ? order by created_at, id')
        .all(assetId)
        .map((row) => mapJob(row as Row));
    },

    nextPending(): AnalysisJob | null {
      const row = db
        .prepare("select * from analysis_jobs where status = 'pending' order by created_at, id limit 1")
        .get() as Row | undefined;
      return row ? mapJob(row) : null;
    },

    claimNextPending(): AnalysisJob | null {
      const claim = db.transaction(() => {
        return db
          .prepare(
            `update analysis_jobs
             set status = 'processing',
                 attempts = attempts + 1,
                 error_message = null,
                 updated_at = ?
             where id = (
               select id from analysis_jobs
               where status = 'pending'
               order by created_at, id
               limit 1
             )
             returning *`
          )
          .get(nowIso()) as Row | undefined;
      });

      const row = claim();
      return row ? mapJob(row) : null;
    },

    updateStatus(jobId: string, status: JobStatus, errorMessage: string | null = null): void {
      db.prepare(
        `update analysis_jobs
         set status = ?,
             error_message = ?,
             attempts = attempts + case when ? = 'processing' then 1 else 0 end,
             updated_at = ?
         where id = ?`
      ).run(status, errorMessage, status, nowIso(), jobId);
    },

    retryFailed(assetId?: string): number {
      const timestamp = nowIso();
      const result = assetId
        ? db
            .prepare(
              `update analysis_jobs
               set status = 'pending', error_message = null, updated_at = ?
               where status = 'failed' and asset_id = ?`
            )
            .run(timestamp, assetId)
        : db
            .prepare(
              `update analysis_jobs
               set status = 'pending', error_message = null, updated_at = ?
               where status = 'failed'`
            )
            .run(timestamp);

      return Number(result.changes);
    },

    summary(): QueueSummary {
      const summary: QueueSummary = {
        pending: 0,
        processing: 0,
        partial: 0,
        done: 0,
        failed: 0,
        skipped: 0
      };
      const rows = db.prepare('select status, count(*) as count from analysis_jobs group by status').all() as Array<{
        status: JobStatus;
        count: number;
      }>;

      for (const row of rows) {
        summary[row.status] = Number(row.count);
      }

      return summary;
    }
  };

  const tags = {
    getOrCreate(displayName: string, source: TagSource): string {
      const normalized = normalizeTagName(displayName);
      const existing = db.prepare('select id from tags where normalized_name = ?').get(normalized) as
        | { id: string }
        | undefined;

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
    },

    replaceAiAssetTags(assetId: string, input: AssetTagInput[]): void {
      const replace = db.transaction(() => {
        db.prepare(
          `delete from asset_tags
           where target_type = 'asset'
             and target_id = ?
             and tag_id in (select id from tags where source = 'ai')`
        ).run(assetId);

        for (const tag of input) {
          tags.assignAssetTag(assetId, tag.displayName, 'ai', tag.confidence);
        }
      });

      replace();
    },

    clearGeneratedForAsset(assetId: string): void {
      db.prepare(
        `delete from asset_tags
         where target_type = 'asset'
           and target_id = ?
           and tag_id in (select id from tags where source in ('ai', 'system'))`
      ).run(assetId);
    }
  };

  const frames = {
    replaceFrames(assetId: string, input: FrameInput[]): void {
      const replace = db.transaction(() => {
        db.prepare('delete from video_frames where asset_id = ?').run(assetId);
        const insert = db.prepare(
          `insert into video_frames (id, asset_id, timestamp_seconds, thumbnail_path, strategy)
           values (?, ?, ?, ?, ?)`
        );

        for (const frame of input) {
          insert.run(createId('frame'), assetId, frame.timestampSeconds, frame.thumbnailPath, frame.strategy);
        }
      });

      replace();
    },

    listForAsset(assetId: string): VideoFrame[] {
      return db
        .prepare('select * from video_frames where asset_id = ? order by timestamp_seconds')
        .all(assetId)
        .map((row) => mapFrame(row as Row));
    }
  };

  const transcripts = {
    replaceSegments(assetId: string, input: TranscriptInput[]): void {
      const replace = db.transaction(() => {
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
      });

      replace();
    },

    listForAsset(assetId: string): TranscriptSegment[] {
      return db
        .prepare('select * from transcript_segments where asset_id = ? order by start_seconds')
        .all(assetId)
        .map((row) => mapTranscript(row as Row));
    }
  };

  return { sources, assets, jobs, tags, frames, transcripts };
}
