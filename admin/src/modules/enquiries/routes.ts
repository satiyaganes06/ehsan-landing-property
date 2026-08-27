import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import { recordAudit } from '../../lib/audit.js';
import { clientIp } from '../../lib/http.js';
import { IdParamSchema, PaginationSchema } from '../../lib/validation.js';

/* ---------------------------------------------------------------------------
   The live site's contact form currently sends nothing -- content.js
   validates the fields and reports "this is a placeholder form, so nothing
   was sent." Every enquiry submitted so far has been discarded. This module
   is the real endpoint; wiring the site's <form> to POST here is a small,
   separate frontend change (out of scope for this build per the "no frontend
   migration yet" decision), documented in the README rather than done here.

   Spam defence is layered because no single measure holds alone:
     - honeypot field, invisible to a real visitor, must arrive empty
     - a submit faster than a human can fill the form is rejected
     - per-IP rate limit via the route-level @fastify/rate-limit config
   Not implemented: Cloudflare Turnstile. It needs a site key wired into the
   (not-yet-migrated) frontend form -- adding the SERVER half alone would be
   unverifiable and is noted as a follow-up rather than half-built here.
   --------------------------------------------------------------------------- */

const PublicEnquiryBody = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  interest: z.string().max(200).optional(),
  message: z.string().min(1).max(4000),
  consent: z.literal(true, { error: 'Consent is required to submit this form.' }),
  // Honeypot: a real visitor never sees or fills this field (hidden via CSS
  // on the form). Any value here means an automated submission.
  website: z.string().max(0).optional().or(z.literal('')),
  // Client records when the form became visible; reject anything submitted
  // faster than a human plausibly reads and fills five fields.
  renderedAt: z.number().optional(),
  utm: z.record(z.string(), z.string()).optional(),
});

const MIN_FILL_MS = 2500;

function hashIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

export async function enquiryRoutes(app: FastifyInstance) {
  app.post(
    '/api/public/enquiries',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    },
    async (req, reply) => {
      const parsed = PublicEnquiryBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'bad_request', message: 'Please complete the required fields.' });
      }
      const { website, renderedAt, consent, utm, ...data } = parsed.data;

      if (website) {
        // Honeypot tripped. 200 with no record written -- a bot that gets a
        // rejection learns to adjust; one that gets a quiet success moves on.
        return reply.send({ ok: true });
      }
      if (renderedAt && Date.now() - renderedAt < MIN_FILL_MS) {
        return reply.send({ ok: true });
      }

      await prisma.enquiry.create({
        data: {
          ...data, utm: utm as any, referrer: req.headers.referer,
          ipHash: hashIp(clientIp(req)), userAgent: req.headers['user-agent'],
          consentAt: new Date(),
        },
      });

      // TODO: transactional email to sales (Resend/Postmark) -- see README.
      return reply.send({ ok: true });
    },
  );

  app.get('/api/enquiries', { preHandler: requirePermission('enquiry', 'read') }, async (req) => {
    const q = req.query as Record<string, string>;
    const { page, perPage } = PaginationSchema.parse(q);
    const where: Record<string, unknown> = {};
    if (q.status) where.status = q.status;
    if (q.assignedTo) where.assignedTo = q.assignedTo;

    const [total, items] = await Promise.all([
      prisma.enquiry.count({ where }),
      prisma.enquiry.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * perPage, take: perPage,
        include: { assignee: { select: { name: true } } },
      }),
    ]);
    return { page, perPage, total, items };
  });

  app.get('/api/enquiries/:id', { preHandler: requirePermission('enquiry', 'read') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });
    const enquiry = await prisma.enquiry.findUnique({ where: { id: params.data.id } });
    if (!enquiry) return reply.code(404).send({ error: 'not_found' });

    if (enquiry.status === 'NEW') {
      await prisma.enquiry.update({ where: { id: enquiry.id }, data: { status: 'READ' } });
      enquiry.status = 'READ';
    }
    return enquiry;
  });

  app.patch('/api/enquiries/:id', { preHandler: requirePermission('enquiry', 'update') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    const body = z.object({
      status: z.enum(['NEW', 'READ', 'REPLIED', 'ARCHIVED', 'SPAM']).optional(),
      assignedTo: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }).safeParse(req.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'bad_request' });

    const enquiry = await prisma.enquiry.update({ where: { id: params.data.id }, data: body.data });
    recordAudit({ actorId: req.user!.id, action: 'enquiry.updated', entityType: 'enquiry', entityId: enquiry.id, diff: body.data, ip: clientIp(req) });
    return reply.send(enquiry);
  });

  app.delete('/api/enquiries/:id', { preHandler: requirePermission('enquiry', 'delete') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });
    await prisma.enquiry.delete({ where: { id: params.data.id } });
    recordAudit({ actorId: req.user!.id, action: 'enquiry.deleted', entityType: 'enquiry', entityId: params.data.id, ip: clientIp(req) });
    return reply.code(204).send();
  });

  app.get('/api/enquiries/export.csv', { preHandler: requirePermission('enquiry', 'read') }, async (req, reply) => {
    const items = await prisma.enquiry.findMany({ orderBy: { createdAt: 'desc' } });
    const header = ['Date', 'Name', 'Email', 'Phone', 'Interest', 'Status', 'Message'];
    const rows = items.map((e) => [
      e.createdAt.toISOString(), e.name, e.email, e.phone ?? '', e.interest ?? '', e.status,
      e.message.replace(/\r?\n/g, ' '),
    ]);
    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = [header, ...rows].map((r) => r.map(escape).join(',')).join('\n');

    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="enquiries.csv"');
    return reply.send(csv);
  });
}
