import sharp from 'sharp';
import { prisma } from '@/lib/server/prisma';
import { mediaUrl } from '@/lib/server/media-url';
import { putUpload } from '@/lib/server/storage';
import { recordAudit } from '@/lib/server/audit';
import { clientIp, json, route } from '@/lib/server/route';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 64 * 1024;
const tooLarge = () => json({ error: 'too_large', message: 'Choose an image of 10 MB or less.' }, 413);

export const POST = route({ resource: 'media', action: 'create' }, async ({ request, user }) => {
  if (Number(request.headers.get('content-length')) > MAX_REQUEST_BYTES) return tooLarge();
  if (!request.body) return json({ error: 'bad_request', message: 'No file uploaded.' }, 400);

  let received = 0;
  const bounded = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > MAX_REQUEST_BYTES) throw new Error('Upload too large');
      controller.enqueue(chunk);
    },
  }));
  let form: FormData;
  try {
    form = await new Response(bounded, { headers: request.headers }).formData();
  } catch {
    if (received > MAX_REQUEST_BYTES) return tooLarge();
    return json({ error: 'bad_request', message: 'Invalid upload form.' }, 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'bad_request', message: 'No file uploaded.' }, 400);
  if (file.size > MAX_FILE_BYTES) return tooLarge();

  const buffer = Buffer.from(await file.arrayBuffer());
  const meta = await sharp(buffer).metadata().catch(() => null);
  const format = meta?.format === 'heif' && meta.compression === 'av1' ? 'avif' : meta?.format;
  if (!meta || !format || !['jpeg', 'png', 'webp', 'avif', 'gif'].includes(format) ||
      file.type !== `image/${format}`) {
    return json({ error: 'bad_request', message: 'Choose a valid JPEG, PNG, WebP, AVIF or GIF image.' }, 400);
  }
  const { width, height } = meta;
  const { storageKey } = await putUpload(buffer, format, file.type);

  const media = await prisma.media.create({
    data: { storageKey, filename: file.name, mimeType: file.type, width, height, bytes: buffer.length },
  });

  recordAudit({
    actorId: user.id, action: 'media.uploaded', entityType: 'media',
    entityId: media.id, ip: clientIp(request),
  });
  return json({ ...media, url: mediaUrl(media.storageKey) }, 201);
});
