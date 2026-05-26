import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function revealInFileManager(filePath: string): Promise<void> {
  const resolved = path.resolve(filePath);
  await access(resolved, constants.F_OK);

  if (process.platform === 'darwin') {
    await execFileAsync('open', ['-R', resolved]);
    return;
  }

  if (process.platform === 'win32') {
    await execFileAsync('explorer', [`/select,${resolved}`]);
    return;
  }

  await execFileAsync('xdg-open', [path.dirname(resolved)]);
}
