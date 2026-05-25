import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const fixtureRoot = path.resolve('.data', 'fixtures', 'factory');
const libraryDatabasePath = path.resolve(process.env.AI_MEDIA_DATA_DIR ?? '.data', 'library.sqlite');

await rm(fixtureRoot, { recursive: true, force: true });
await rm(libraryDatabasePath, { force: true });
await mkdir(fixtureRoot, { recursive: true });

await Promise.all([
  writeFile(path.join(fixtureRoot, 'factory_cutting.jpg'), 'mock factory cutting image\n'),
  writeFile(path.join(fixtureRoot, 'sewing_line.jpg'), 'mock sewing line image\n'),
  writeFile(path.join(fixtureRoot, 'notes.txt'), 'mock notes for skipped fixture\n')
]);

console.log(fixtureRoot);
