import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import { recordAudit } from '../../lib/audit.js';
import { clientIp } from '../../lib/http.js';
import { IdParamSchema } from '../../lib/validation.js';
import { mediaUrl } from '../../lib/media-url.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.resolve(HERE, '../../../uploads');

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);

const AltTextBody = z.object({ altText: z.string().max(200) });
const FocalBody = z.object({ focalX: z.number().min(0).max(1), focalY: z.number().min(0).max(1) });

export async function mediaRoutes(app: FastifyInstance) {
  app.get('/api/media', { preHandler: requirePermission('media', 'read') }, async (req) => {
    const q = req.query as { q?: string; missingAlt?: string };
    const where: Record<string, unknown> = {};
    if (q.q) where.filename = { contains: q.q, mode: 'insensitive' };
    if (q.missingAlt === 'true') where.altText = null;

    const items = await prisma.media.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    return items.map((m) => ({ ...m, url: mediaUrl(m.storageKey) }));
  });

  app.post(
    '/api/media/upload',
    { preHandler: requirePermission('media', 'create') },
    async (req, reply) => {
      const file = await req.file();
      if (!file) return reply.code(400).send({ error: 'bad_request', message: 'No file uploaded.' });
      if (!ALLOWED_MIME.has(file.mimetype)) {
        return reply.code(400).send({ error: 'bad_request', message: `Unsupported file type: ${file.mimetype}` });
      }

      const buffer = await file.toBuffer();
      const ext = (file.filename.split('.').pop() || 'bin').toLowerCase();
      const now = new Date();
      const dir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
      const key = `${randomUUID()}.${ext}`;
      const relPath = `${dir}/${key}`;
      const absDir = path.join(UPLOAD_ROOT, dir);

      await mkdir(absDir, { recursive: true });
      await writeFile(path.join(absDir, key), buffer);

      // Dimensions read from the actual bytes, not trusted from the upload --
      // a mislabelled or corrupt file should fail here, not surface as a
      // silently-wrong aspect ratio deep in a template later.
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
        data: {
          storageKey: `upload:${relPath}`, filename: file.filename, mimeType: file.mimetype,
          width, height, bytes: buffer.length,
        },
      });

      recordAudit({ actorId: req.user!.id, action: 'media.uploaded', entityType: 'media', entityId: media.id, ip: clientIp(req) });
      return reply.code(201).send({ ...media, url: mediaUrl(media.storageKey) });
    },
  );

  app.patch('/api/media/:id/alt', { preHandler: requirePermission('media', 'update') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    const body = AltTextBody.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'bad_request' });
    const media = await prisma.media.update({ where: { id: params.data.id }, data: { altText: body.data.altText } });
    return reply.send(media);
  });

  app.patch('/api/media/:id/focal', { preHandler: requirePermission('media', 'update') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    const body = FocalBody.safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'bad_request' });
    const media = await prisma.media.update({ where: { id: params.data.id }, data: body.data });
    return reply.send(media);
  });

  app.delete('/api/media/:id', { preHandler: requirePermission('media', 'delete') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });

    const media = await prisma.media.findUnique({ where: { id: params.data.id } });
    if (!media) return reply.code(404).send({ error: 'not_found' });

    const inUse = await prisma.projectMedia.count({ where: { mediaId: media.id } });
    if (inUse > 0) {
      return reply.code(409).send({ error: 'conflict', message: `Still attached to ${inUse} project(s) — detach first.` });
    }

    await prisma.media.delete({ where: { id: media.id } });

    // Legacy (imported) files are never deleted from disk -- they belong to
    // the site's own assets/ directory, not to this upload store.
    if (media.storageKey.startsWith('upload:')) {
      await unlink(path.join(UPLOAD_ROOT, media.storageKey.slice('upload:'.length))).catch(() => {});
    }

    recordAudit({ actorId: req.user!.id, action: 'media.deleted', entityType: 'media', entityId: params.data.id, ip: clientIp(req) });
    return reply.code(204).send();
  });
}
