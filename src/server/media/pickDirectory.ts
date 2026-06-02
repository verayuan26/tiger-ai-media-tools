import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export class DirectoryPickerUnavailableError extends Error {
  constructor(message = 'Native directory picker is not available on this platform') {
    super(message);
    this.name = 'DirectoryPickerUnavailableError';
  }
}

export class DirectoryPickerCancelledError extends Error {
  constructor() {
    super('Directory picker was cancelled');
    this.name = 'DirectoryPickerCancelledError';
  }
}

function isUserCancelled(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const err = error as { code?: number | string; message?: string };
  if (err.code === 1) return true;
  if (typeof err.message === 'string' && err.message.includes('User canceled')) return true;
  return false;
}

export async function pickDirectory(prompt = '选择素材目录'): Promise<string> {
  if (process.platform === 'darwin') {
    const escapedPrompt = prompt.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    try {
      const { stdout } = await execFileAsync('osascript', [
        '-e',
        `POSIX path of (choose folder with prompt "${escapedPrompt}")`
      ]);
      const picked = stdout.trim();
      if (!picked) {
        throw new DirectoryPickerCancelledError();
      }
      return picked.endsWith('/') ? picked.slice(0, -1) : picked;
    } catch (error) {
      if (error instanceof DirectoryPickerCancelledError) throw error;
      if (isUserCancelled(error)) {
        throw new DirectoryPickerCancelledError();
      }
      throw error;
    }
  }

  if (process.platform === 'win32') {
    const escapedPrompt = prompt.replace(/'/g, "''");
    // Use a TopMost invisible owner form so the dialog always appears in front.
    // -STA is required for WinForms; -NonInteractive must NOT be used here as it
    // explicitly prevents interactive dialogs from appearing.
    const script = [
      '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
      '$OutputEncoding = [System.Text.Encoding]::UTF8',
      'Add-Type -AssemblyName System.Windows.Forms',
      '[System.Windows.Forms.Application]::EnableVisualStyles()',
      '$owner = New-Object System.Windows.Forms.Form',
      '$owner.TopMost = $true',
      '$owner.ShowInTaskbar = $false',
      '$owner.WindowState = [System.Windows.Forms.FormWindowState]::Minimized',
      '$owner.Show()',
      '$owner.Hide()',
      '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
      `$dialog.Description = '${escapedPrompt}'`,
      '$dialog.ShowNewFolderButton = $true',
      '$result = $dialog.ShowDialog($owner)',
      '$owner.Dispose()',
      'if ($result -eq [System.Windows.Forms.DialogResult]::OK) {',
      '  Write-Output $dialog.SelectedPath',
      '}'
    ].join('; ');

    try {
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-STA',
        '-Command',
        script
      ], { encoding: 'utf8' });
      const picked = stdout.trim();
      if (!picked) {
        throw new DirectoryPickerCancelledError();
      }
      return picked;
    } catch (error) {
      if (error instanceof DirectoryPickerCancelledError) throw error;
      if (isUserCancelled(error)) {
        throw new DirectoryPickerCancelledError();
      }
      throw error;
    }
  }

  try {
    const { stdout } = await execFileAsync('zenity', [
      '--file-selection',
      '--directory',
      '--title',
      prompt
    ]);
    const picked = stdout.trim();
    if (!picked) {
      throw new DirectoryPickerCancelledError();
    }
    return picked;
  } catch (error) {
    if (error instanceof DirectoryPickerCancelledError) throw error;
    if (isUserCancelled(error)) {
      throw new DirectoryPickerCancelledError();
    }

    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      throw new DirectoryPickerUnavailableError(
        'Install zenity to pick directories on Linux, or paste an absolute path manually'
      );
    }
    throw error;
  }
}
