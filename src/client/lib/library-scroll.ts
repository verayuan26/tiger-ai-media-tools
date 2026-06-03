const STORAGE_PREFIX = 'ai-media-library-scroll:';

export function libraryScrollStorageKey(filtersSignature: string): string {
  return `${STORAGE_PREFIX}${filtersSignature}`;
}

export function saveLibraryScroll(storageKey: string, scrollTop: number): void {
  try {
    sessionStorage.setItem(storageKey, String(Math.round(scrollTop)));
  } catch {
    // sessionStorage may be unavailable in some environments
  }
}

export function readLibraryScroll(storageKey: string): number {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return 0;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}
