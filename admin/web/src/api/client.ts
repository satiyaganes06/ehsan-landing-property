/* Thin fetch wrapper. Every request sends cookies (the session lives in an
   httpOnly cookie, never in JS-reachable storage) and every non-2xx response
   is normalised into one ApiError shape so calling code never has to sniff
   response.ok in three different places. */

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const message = (isJson && payload && typeof payload === 'object' && 'message' in payload)
      ? String((payload as any).message)
      : `Request failed (${res.status})`;
    const code = isJson && payload && typeof payload === 'object' && 'error' in payload ? String((payload as any).error) : undefined;
    throw new ApiError(res.status, message, code);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export async function uploadFile(path: string, file: File): Promise<any> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(path, { method: 'POST', credentials: 'include', body: form });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, payload?.message ?? 'Upload failed', payload?.error);
  return payload;
}
