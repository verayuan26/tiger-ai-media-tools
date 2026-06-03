import { describe, expect, it } from 'vitest';
import { clearHttpDispatcherCache, getHttpDispatcher, normalizeProxyUrl } from '../ai/httpClient';

describe('httpClient', () => {
  it('normalizeProxyUrl trims and defaults empty', () => {
    expect(normalizeProxyUrl('  http://127.0.0.1:7890  ')).toBe('http://127.0.0.1:7890');
    expect(normalizeProxyUrl(null)).toBe('');
    expect(normalizeProxyUrl(undefined)).toBe('');
  });

  it('caches dispatchers per proxy key and clears on demand', () => {
    clearHttpDispatcherCache();
    const envA = getHttpDispatcher();
    const envB = getHttpDispatcher();
    expect(envA).toBe(envB);

    const proxyA = getHttpDispatcher('http://127.0.0.1:7890');
    const proxyB = getHttpDispatcher('http://127.0.0.1:7890');
    expect(proxyA).toBe(proxyB);
    expect(proxyA).not.toBe(envA);

    clearHttpDispatcherCache();
    const envAfterClear = getHttpDispatcher();
    expect(envAfterClear).not.toBe(envA);
  });
});
