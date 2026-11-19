import type { BootstrapPayload } from '../types/society';

const STORAGE_CACHE_KEY = 'civicnest_offline_cache_v1';

export async function apiRequest<T = BootstrapPayload>(
  url: string,
  userId: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const errBody = (await response.json()) as { error?: string };
      if (errBody?.error) message = errBody.error;
    } catch {
      // ignore non-json error
    }
    throw new Error(message);
  }

  const data = (await response.json()) as T;
  if (url.startsWith('/api/bootstrap') || (options?.method && options.method !== 'GET')) {
    try {
      const targetUserId =
        typeof data === 'object' &&
        data !== null &&
        'currentUser' in data &&
        (data as unknown as BootstrapPayload).currentUser?.id
          ? (data as unknown as BootstrapPayload).currentUser.id
          : userId;
      localStorage.setItem(`${STORAGE_CACHE_KEY}_${targetUserId}`, JSON.stringify(data));
    } catch {
      // ignore quota errors
    }
  }
  return data;
}

export async function uploadSocialImage(dataUrl: string, userId: string): Promise<string> {
  const res = await fetch('/api/social/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    },
    body: JSON.stringify({ dataUrl }),
  });

  if (!res.ok) {
    let msg = 'Image upload failed.';
    try {
      const err = (await res.json()) as { error?: string };
      if (err?.error) msg = err.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  const body = (await res.json()) as { url: string };
  return body.url;
}

export function loadCachedBootstrap(userId: string): BootstrapPayload | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_CACHE_KEY}_${userId}`);
    return raw ? (JSON.parse(raw) as BootstrapPayload) : null;
  } catch {
    return null;
  }
}
