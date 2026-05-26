import type { LibrarySourceStats } from '../../shared/types';

export function isSourceDisconnected(source: LibrarySourceStats): boolean {
  return (
    !source.incrementalScanEnabled &&
    /external|volumes/i.test(source.rootPath)
  );
}
