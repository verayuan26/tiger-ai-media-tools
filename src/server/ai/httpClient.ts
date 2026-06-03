import { EnvHttpProxyAgent, ProxyAgent, type Dispatcher } from 'undici';

const ENV_DISPATCHER_KEY = '__env__';
const dispatchers = new Map<string, Dispatcher>();

export function clearHttpDispatcherCache(): void {
  dispatchers.clear();
}

export function normalizeProxyUrl(value: string | null | undefined): string {
  return value?.trim() ?? '';
}

export function getHttpDispatcher(proxyUrl?: string | null): Dispatcher | undefined {
  const configured = normalizeProxyUrl(proxyUrl);
  const cacheKey = configured || ENV_DISPATCHER_KEY;
  const existing = dispatchers.get(cacheKey);
  if (existing) {
    return existing;
  }

  const dispatcher = configured
    ? new ProxyAgent({ uri: configured })
    : new EnvHttpProxyAgent();

  dispatchers.set(cacheKey, dispatcher);
  return dispatcher;
}

export async function aiFetch(
  input: string | URL,
  init: RequestInit = {},
  proxyUrl?: string | null
): Promise<Response> {
  const dispatcher = getHttpDispatcher(proxyUrl);
  if (!dispatcher) {
    return fetch(input, init);
  }

  return fetch(input, {
    ...init,
    dispatcher
  } as RequestInit & { dispatcher: Dispatcher });
}
