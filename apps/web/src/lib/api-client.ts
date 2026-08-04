import { ApiError } from './api-error';
import { getAccessToken, setAccessToken } from './auth-token';

const API_URL = `${import.meta.env.VITE_API_URL}/api/v1`;

// Routes excluded from the 401-retry: a 401 here means "not logged in" /
// "bad credentials", not "token expired" — retrying would just loop.
const AUTH_RETRY_EXCLUDED = ['/auth/login', '/auth/refresh'];

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const { body, headers, ...rest } = options;
  const token = getAccessToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    // sends the httpOnly refresh cookie set by apps/api
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 204 No Content has no body to parse
  const data = res.status === 204 ? null : await res.json();

  if (!res.ok) {
    throw new ApiError(data.statusCode, data.code, data.message, data.details);
  }

  return data as T;
}

// Shared across callers so concurrent 401s trigger one /auth/refresh, not one each.
let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  refreshPromise ??= request<{ accessToken: string }>('/auth/refresh', { method: 'POST' })
    .then(({ accessToken }) => {
      setAccessToken(accessToken);
      return accessToken;
    })
    .catch((err) => {
      setAccessToken(null);
      throw err;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await request<T>(path, options);
  } catch (err) {
    const canRetry =
      err instanceof ApiError && err.status === 401 && !AUTH_RETRY_EXCLUDED.includes(path);
    if (!canRetry) {
      throw err;
    }

    await refreshAccessToken();
    return request<T>(path, options);
  }
}
