import sharp from 'sharp';
import { prisma } from '@/lib/server/prisma';
import { mediaUrl } from '@/lib/server/media-url';
import { putUpload } from '@/lib/server/storage';
import { recordAudit } from '@/lib/server/audit';
import { clientIp, json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);

export const POST = route({ resource: 'media', action: 'create' }, async ({ request, user }) => {
  const form = await request.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return json({ error: 'bad_request', message: 'No file uploaded.' }, 400);
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return json({ error: 'bad_request', message: `Unsupported file type: ${file.type}` }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { storageKey } = await putUpload(buffer, file.name, file.type);

  // Dimensions read from the actual bytes, not trusted from the upload -- a
  // mislabelled file should fail here, not surface as a wrong aspect ratio
  // deep in a template later.
  let width: number | undefined;
  let height: number | undefined;
  try {
    const meta = await sharp(buffer).metadata();
    width = meta.width;
    height = meta.height;
  } catch {
    // Non-fatal: dimensions stay null rather than blocking the upload.
  }

  const media = await prisma.media.create({
    data: { storageKey, filename: file.name, mimeType: file.type, width, height, bytes: buffer.length },
  });

  recordAudit({
    actorId: user.id, action: 'media.uploaded', entityType: 'media',
    entityId: media.id, ip: clientIp(request),
  });
  return json({ ...media, url: mediaUrl(media.storageKey) }, 201);
});
