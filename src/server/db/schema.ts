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
