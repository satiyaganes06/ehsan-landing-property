/** Enforce the same byte budget for fixed-length and streamed requests. */
export async function readBoundedJson(request: Request, limit: number): Promise<
  { ok: true; value: unknown } | { ok: false; status: 400 | 413 }
> {
  const oversized = { ok: false, status: 413 } as const;
  if (Number(request.headers.get('content-length')) > limit) return oversized;
  const reader = request.body?.getReader();
  if (!reader) return { ok: false, status: 400 };

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => {});
        return oversized;
      }
      if (value.byteLength) chunks.push(value);
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size));
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400 };
  } finally {
    reader.releaseLock();
  }
}
