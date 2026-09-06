import { NextResponse } from 'next/server';
import { readLocalUpload } from '@/lib/server/storage';
import { publicRoute } from '@/lib/server/route';

export const runtime = 'nodejs';

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', avif: 'image/avif', gif: 'image/gif',
};

/**
 * Serves locally-stored uploads — what Fastify's static mount used to do.
 * Blob-backed uploads never reach here: their storageKey already carries an
 * absolute CDN URL, so the browser goes straight to it.
 */
export const GET = publicRoute<{ path: string[] }>(async ({ params }) => {
  const rel = params.path.join('/');
  const bytes = await readLocalUpload(rel);
  if (!bytes) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const ext = rel.split('.').pop()?.toLowerCase() ?? '';
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
});
