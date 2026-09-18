import { z } from 'zod';
import { prisma } from '@/lib/server/prisma';
import { recordAudit, recordRevision } from '@/lib/server/audit';
import { recomputeSeo } from '@/lib/server/recompute-seo';
import { scoringInputFor } from '@/lib/server/seo-input';
import { canActOnOwnRecord } from '@/lib/server/ownership';
import { uniqueSlug } from '@/lib/server/slug';
import { clientIp, forbiddenOwnership, json, route } from '@/lib/server/route';
import { LocaleSchema } from '@/lib/server/validation';

export const runtime = 'nodejs';

const AgendaItem = z.object({ time: z.string(), title: z.string(), description: z.string() });
const Speaker = z.object({
  name: z.string(), title: z.string(),
  image: z.string().optional(), bio: z.string().optional(),
});

const TranslationBody = z.object({
  slug: z.string().min(1).optional(),
  title: z.string().min(1),
  category: z.string().min(1),
  location: z.string().min(1),
  description: z.string(),
  agenda: z.array(AgendaItem).default([]),
  speakers: z.array(Speaker).default([]),
  highlights: z.array(z.string()).default([]),
});

export const PUT = route<{ id: string; locale: string }>(
  { resource: 'event', action: 'update' },
  async ({ request, params, user }) => {
    const locale = LocaleSchema.parse(params.locale);
    const body = TranslationBody.parse(await request.json());

    const event = await prisma.event.findUnique({ where: { id: params.id } });
    if (!event) return json({ error: 'not_found', message: 'Event not found.' }, 404);
    if (!canActOnOwnRecord(user, event.createdById)) return forbiddenOwnership();

    const slug =
      body.slug ??
      (await uniqueSlug(body.title, async (candidate) => {
        const hit = await prisma.eventTranslation.findUnique({
          where: { locale_slug: { locale, slug: candidate } },
        });
        return Boolean(hit && hit.eventId !== event.id);
      }));

    const where = { eventId_locale: { eventId: event.id, locale } };
    const existing = await prisma.eventTranslation.findUnique({ where });
    if (existing) recordRevision('event_translation', existing.id, existing, user.id);

    const translation = await prisma.eventTranslation.upsert({
      where,
      create: { eventId: event.id, locale, slug, ...body },
      update: { slug, ...body },
    });

    const scoring = await scoringInputFor('event', event.id, locale);
    await recomputeSeo({ entityType: 'event', entityId: event.id, locale, ...scoring });

    recordAudit({
      actorId: user.id, action: 'event.translation.updated', entityType: 'event',
      entityId: event.id, ip: clientIp(request),
    });
    return json(translation);
  },
);
