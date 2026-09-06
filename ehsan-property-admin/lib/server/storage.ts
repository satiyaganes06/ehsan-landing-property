import 'server-only';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Where uploaded images live.
 *
 * Two drivers behind one interface. Local disk is the default so development
 * needs no credentials; Vercel Blob takes over automatically the moment
 * BLOB_READ_WRITE_TOKEN is present, which is what makes this deployable --
 * Vercel has no writable filesystem, so the local driver cannot run there.
 *
 * The driver is recorded in the storageKey prefix rather than inferred at read
 * time, so files uploaded before a switch keep resolving afterwards.
 */

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

export function usingBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export interface StoredFile {
  /** Persisted on Media.storageKey. */
  storageKey: string;
}

export async function putUpload(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<StoredFile> {
  const ext = (filename.split('.').pop() || 'bin').toLowerCase();
  const now = new Date();
  const relPath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${randomUUID()}.${ext}`;

  if (usingBlob()) {
    const { put } = await import('@vercel/blob');
    const blob = await put(relPath, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
    });
    // The whole URL is the key: Blob hands back a CDN host we do not control
    // and should not try to reconstruct later.
    return { storageKey: `blob:${blob.url}` };
  }

  const abs = path.join(UPLOAD_ROOT, relPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buffer);
  return { storageKey: `upload:${relPath}` };
}

export async function deleteUpload(storageKey: string): Promise<void> {
  // Legacy files belong to the site's own assets/ directory, not to this
  // store, and are never removed here.
  if (storageKey.startsWith('blob:')) {
    const { del } = await import('@vercel/blob');
    await del(storageKey.slice('blob:'.length)).catch(() => {});
    return;
  }
  if (storageKey.startsWith('upload:')) {
    await unlink(path.join(UPLOAD_ROOT, storageKey.slice('upload:'.length))).catch(() => {});
  }
}

/** Reads a locally-stored upload for the /media/uploads route to serve. */
export async function readLocalUpload(relPath: string): Promise<Buffer | null> {
  const abs = path.join(UPLOAD_ROOT, relPath);
  // Refuse anything that escapes the upload root.
  if (!abs.startsWith(UPLOAD_ROOT + path.sep)) return null;
  return readFile(abs).catch(() => null);
}
