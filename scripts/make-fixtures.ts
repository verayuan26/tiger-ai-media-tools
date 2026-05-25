import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const fixtureRoot = path.resolve('.data', 'fixtures', 'factory');

await mkdir(fixtureRoot, { recursive: true });

await Promise.all([
  writeFile(path.join(fixtureRoot, 'factory_cutting.jpg'), 'mock factory cutting image\n'),
  writeFile(path.join(fixtureRoot, 'sewing_line.jpg'), 'mock sewing line image\n'),
  writeFile(path.join(fixtureRoot, 'worker_talk_ru.wav'), 'mock russian worker talk audio\n'),
  writeFile(path.join(fixtureRoot, 'notes.txt'), 'mock notes for skipped fixture\n')
]);

console.log(fixtureRoot);
