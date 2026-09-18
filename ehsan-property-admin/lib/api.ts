/**
 * Thin fetch wrapper over the Fastify API.
 *
 * Two jobs beyond calling fetch: every non-2xx becomes one ApiError shape, so
 * no caller sniffs response.ok; and a 401 anywhere fires a single global
 * event, so an expired session produces one redirect instead of every mounted
 * query independently rendering an empty state.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }

  get isAuth() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }
}

export const SESSION_EXPIRED_EVENT = 'ehsan:session-expired';

function announceSessionExpiry() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

type Payload = Record<string, unknown> | unknown[] | null;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload: Payload | string = isJson
    ? await res.json().catch(() => null)
    : await res.text();

  if (!res.ok) {
    const record = isJson && payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
    const message = typeof record?.message === 'string' ? record.message : fallbackMessage(res.status);
    const code = typeof record?.error === 'string' ? record.error : undefined;

    if (res.status === 401) announceSessionExpiry();
    throw new ApiError(res.status, message, code);
  }

  return payload as T;
}

/** Server messages are preferred; these cover the cases where there isn't one. */
function fallbackMessage(status: number) {
  if (status === 401) return 'Your session has ended. Sign in again to continue.';
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return 'That record no longer exists.';
  if (status === 429) return 'Too many attempts. Wait a moment and try again.';
  if (status >= 500) return "The server couldn't complete that request.";
  return `Request failed (${status})`;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

/** Multipart upload — FormData sets its own boundary, so no Content-Type here. */
export async function uploadFile<T>(path: string, file: File, fields?: Record<string, string>): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  for (const [key, value] of Object.entries(fields ?? {})) form.append(key, value);

  const res = await fetch(path, { method: 'POST', credentials: 'include', body: form });
  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401) announceSessionExpiry();
    throw new ApiError(res.status, payload?.message ?? fallbackMessage(res.status), payload?.error);
  }
  return payload as T;
}
