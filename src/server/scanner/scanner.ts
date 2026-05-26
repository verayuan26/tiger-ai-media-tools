import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { opendir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { createRepositories } from '../db/repositories';
import { stagesForKind } from '../jobs/stagesForKind';
import { classifyMediaFile } from './fileTypes';

type Repositories = ReturnType<typeof createRepositories>;

export interface ImportSourceInput {
  rootPath: string;
  name: string;
  incrementalScanEnabled?: boolean;
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

export async function importSourceDirectory(
  repos: Repositories,
  input: ImportSourceInput
): Promise<ImportSourceResult> {
  const rootPath = path.resolve(input.rootPath);
  const source = repos.sources.upsertSource({
    name: input.name,
    rootPath,
    incrementalScanEnabled: input.incrementalScanEnabled
  });

  let indexed = 0;
  let skipped = 0;

  for await (const filePath of walkFiles(rootPath)) {
    const resolvedFilePath = path.resolve(filePath);
    const classified = classifyMediaFile(resolvedFilePath);
    if (!classified) {
      skipped += 1;
      continue;
    }

    const fileStat = await stat(filePath);
    const fileHash = await hashFile(filePath);
    const modifiedAt = fileStat.mtime.toISOString();
    const existing = repos.assets.getByPath(resolvedFilePath);
    const stages = stagesForKind(classified.kind);

    if (existing && existing.sizeBytes === fileStat.size && existing.hash === fileHash) {
      if (existing.modifiedAt !== modifiedAt) {
        repos.assets.touchModifiedAt(existing.id, modifiedAt);
      }
      indexed += 1;
      continue;
    }

    const assetInput = {
      sourceId: source.id,
      path: resolvedFilePath,
      fileName: path.basename(resolvedFilePath),
      kind: classified.kind,
      extension: classified.extension,
      sizeBytes: fileStat.size,
      hash: fileHash,
      modifiedAt
    };
    if (existing) {
      repos.assets.refreshChangedAsset(assetInput, stages);
    } else {
      const asset = repos.assets.upsertAsset(assetInput);
      repos.jobs.ensureJobs(asset.id, stages);
    }
    indexed += 1;
  }

  repos.sources.markScanned(source.id);
  return { sourceId: source.id, indexed, skipped };
}
