import { ApiError } from '../api';

export type PickDirectoryResult =
  | { status: 'selected'; path: string }
  | { status: 'cancelled' }
  | { status: 'unavailable'; message: string };

export async function pickDirectoryFromSystem(): Promise<PickDirectoryResult> {
  try {
    const response = await fetch('/api/system/pick-directory', {
      method: 'POST',
      headers: { Accept: 'application/json' }
    });
    const payload = (await response.json()) as { path?: string; cancelled?: boolean; error?: { message: string } };

    if (response.status === 503) {
      return {
        status: 'unavailable',
        message: payload.error?.message ?? '当前环境无法打开系统目录选择器'
      };
    }

    if (!response.ok) {
      throw new ApiError(payload.error?.message ?? '无法打开目录选择器', response.status);
    }

    if (payload.cancelled) {
      return { status: 'cancelled' };
    }

    if (typeof payload.path === 'string' && payload.path.trim().length > 0) {
      return { status: 'selected', path: payload.path.trim() };
    }

    return { status: 'cancelled' };
  } catch (error) {
    if (error instanceof ApiError && error.status === 503) {
      return { status: 'unavailable', message: error.message };
    }
    throw error;
  }
}

export async function pickFileFromSystem(filter?: string): Promise<PickDirectoryResult> {
  try {
    const response = await fetch('/api/system/pick-file', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter })
    });
    const payload = (await response.json()) as { path?: string; cancelled?: boolean; error?: { message: string } };

    if (response.status === 503) {
      return {
        status: 'unavailable',
        message: payload.error?.message ?? '当前环境无法打开文件选择器'
      };
    }

    if (!response.ok) {
      throw new ApiError(payload.error?.message ?? '无法打开文件选择器', response.status);
    }

    if (payload.cancelled) {
      return { status: 'cancelled' };
    }

    if (typeof payload.path === 'string' && payload.path.trim().length > 0) {
      return { status: 'selected', path: payload.path.trim() };
    }

    return { status: 'cancelled' };
  } catch (error) {
    if (error instanceof ApiError && error.status === 503) {
      return { status: 'unavailable', message: error.message };
    }
    throw error;
  }
}

export function defaultSourceNameFromPath(directoryPath: string): string {
  const normalized = directoryPath.replace(/[\\/]+$/, '');
  const segments = normalized.split(/[\\/]/).filter(Boolean);
  const base = segments.at(-1);
  return base && base.length > 0 ? base : '新素材库';
}
