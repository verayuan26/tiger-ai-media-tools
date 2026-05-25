import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dataRoot = path.resolve('.data');
const fixtureRoot = path.resolve('.data', 'fixtures', 'factory');
const configuredDataDir = process.env.AI_MEDIA_DATA_DIR;
const dataDir = configuredDataDir ? path.resolve(configuredDataDir) : undefined;
const relativeDataDir = dataDir ? path.relative(dataRoot, dataDir) : undefined;
const isDataDirWithinDataRoot =
  relativeDataDir !== undefined &&
  (relativeDataDir === '' || (!relativeDataDir.startsWith('..') && !path.isAbsolute(relativeDataDir)));
const libraryDatabasePath = dataDir && isDataDirWithinDataRoot ? path.join(dataDir, 'library.sqlite') : undefined;

await rm(fixtureRoot, { recursive: true, force: true });
if (libraryDatabasePath) {
  await rm(libraryDatabasePath, { force: true });
}
await mkdir(fixtureRoot, { recursive: true });

await Promise.all([
  writeFile(path.join(fixtureRoot, 'factory_cutting.jpg'), 'mock factory cutting image\n'),
  writeFile(path.join(fixtureRoot, 'sewing_line.jpg'), 'mock sewing line image\n'),
  writeFile(path.join(fixtureRoot, 'notes.txt'), 'mock notes for skipped fixture\n')
]);

console.log(fixtureRoot);
