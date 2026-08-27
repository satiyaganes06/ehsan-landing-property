/* ---------------------------------------------------------------------------
   Seed script.

   Two kinds of source data, handled differently on purpose:

     - data/projects.json and data/events.json are the site's OWN dynamic
       data files -- read directly, at seed time, from the live path.
     - Awards, testimonials, and the ledger-card fields (year/RM/bar weight/
       status tag) exist ONLY as hardcoded HTML in index.html today. Rather
       than re-parse the page here (fragile against future markup edits),
       those were extracted once into prisma/seed-data/*.json by a one-off
       script and are committed as static fixtures. This file trusts them.

   Everything imported this way is marked PUBLISHED -- it is what is already
   live. A fresh install with no prior content would instead start every
   record as DRAFT; there is no such thing here, because this codebase
   already has a production site to import from.
   --------------------------------------------------------------------------- */

import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../src/lib/password.js';
import { ROLES, ROLE_PERMISSIONS, allGrantedPermissions } from '../src/lib/permissions.js';
import { evaluateSeo } from '../src/lib/seo-score.js';

const prisma = new PrismaClient();
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE_DATA = path.resolve(HERE, '../../data');
const SEED_DATA = path.resolve(HERE, 'seed-data');

async function readJson<T>(p: string): Promise<T> {
  return JSON.parse(await readFile(p, 'utf8')) as T;
}

async function seedRbac() {
  for (const perm of allGrantedPermissions()) {
    await prisma.permission.upsert({
      where: { resource_action: { resource: perm[0], action: perm[1] } },
      create: { resource: perm[0], action: perm[1] },
      update: {},
    });
  }

  for (const role of ROLES) {
    const grants = ROLE_PERMISSIONS[role.key] ?? [];
    const perms = await prisma.permission.findMany({
      where: { OR: grants.map(([resource, action]) => ({ resource, action })) },
    });
    await prisma.role.upsert({
      where: { key: role.key },
      create: {
        key: role.key,
        label: role.label,
        rank: role.rank,
        permissions: { create: perms.map((p) => ({ permissionId: p.id })) },
      },
      update: {
        label: role.label,
        rank: role.rank,
        permissions: {
          deleteMany: {},
          create: perms.map((p) => ({ permissionId: p.id })),
        },
      },
    });
  }
  console.log(`✓ ${ROLES.length} roles, ${allGrantedPermissions().length} permissions`);
}

async function seedOwner() {
  const email = process.env.SEED_OWNER_EMAIL || 'owner@ehsanproperty.com';
  const password = process.env.SEED_OWNER_PASSWORD || randomPassword();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✓ owner already exists (${email})`);
    return;
  }

  const owner = await prisma.role.findUniqueOrThrow({ where: { key: 'owner' } });
  await prisma.user.create({
    data: {
      email,
      name: 'Owner',
      passwordHash: await hashPassword(password),
      roles: { create: [{ roleId: owner.id }] },
    },
  });

  console.log(`✓ owner account created`);
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}${process.env.SEED_OWNER_PASSWORD ? '' : '   (generated -- save this, it will not be shown again)'}`);
}

function randomPassword(): string {
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 8)).join('-');
}

interface ProjectCardFixture {
  reference: string; sortOrder: number; dataVal: number; image: string;
  tagClass: string; occupancyTag: string; yearStart: string; yearEnd: string;
  name: string; location: string; gdvRm: number | null; barWeight: number;
}

interface JsonProject {
  name: string; location: string; coordinates: { lat: number; lng: number } | null;
  year: string; status: string; description: string; units: string; area: string;
  priceRange: string; occupancy: string; amenities: string[]; certificate: string | null;
  media: { image: string[]; blueprint: string[] };
}

async function seedProjects() {
  const cards = await readJson<ProjectCardFixture[]>(path.join(SEED_DATA, 'project-cards.json'));
  const detail = await readJson<Record<string, JsonProject>>(path.join(SITE_DATA, 'projects.json'));

  const statusMap: Record<string, 'COMPLETED' | 'ONGOING' | 'FUTURE'> = {
    Completed: 'COMPLETED', Ongoing: 'ONGOING', Future: 'FUTURE',
  };

  for (const card of cards) {
    const d = detail[card.reference];
    if (!d) {
      console.warn(`⚠ ${card.reference} has a ledger card but no data/projects.json entry -- skipped`);
      continue;
    }

    const project = await prisma.project.upsert({
      where: { reference: card.reference },
      create: {
        reference: card.reference,
        status: statusMap[d.status] ?? 'COMPLETED',
        yearStart: card.yearStart, yearEnd: card.yearEnd,
        latitude: d.coordinates?.lat, longitude: d.coordinates?.lng,
        units: d.units, areaText: d.area, priceRange: d.priceRange,
        occupancy: d.occupancy || card.occupancyTag,
        gdvMillions: card.gdvRm != null ? card.gdvRm / 1_000_000 : null,
        barWeight: card.barWeight, sortOrder: card.sortOrder,
        publishState: 'PUBLISHED', publishedAt: new Date(),
      },
      update: {},
    });

    await prisma.projectTranslation.upsert({
      where: { projectId_locale: { projectId: project.id, locale: 'EN' } },
      create: {
        projectId: project.id, locale: 'EN', slug: card.reference,
        name: d.name, location: d.location, description: d.description,
        amenities: d.amenities, certificate: d.certificate,
      },
      update: {},
    });

    // Media: import the SAME filenames already referenced on the live site,
    // pointed at the repo's own assets/img/ via the "legacy:" storage prefix
    // -- see src/lib/media-url.ts. Nothing is re-uploaded or re-encoded.
    const allImages = [...new Set([...d.media.image, ...d.media.blueprint, card.image])];
    for (const filename of allImages) {
      await prisma.media.upsert({
        where: { storageKey: `legacy:img/${filename}` },
        create: {
          storageKey: `legacy:img/${filename}`, filename, mimeType: 'image/jpeg', bytes: 0,
        },
        update: {},
      });
    }

    await prisma.projectMedia.deleteMany({ where: { projectId: project.id } });
    let order = 0;
    for (const filename of d.media.image) {
      const media = await prisma.media.findUniqueOrThrow({ where: { storageKey: `legacy:img/${filename}` } });
      await prisma.projectMedia.create({
        data: { projectId: project.id, mediaId: media.id, role: 'gallery', sortOrder: order++ },
      });
    }
    order = 0;
    for (const filename of d.media.blueprint) {
      const media = await prisma.media.findUniqueOrThrow({ where: { storageKey: `legacy:img/${filename}` } });
      await prisma.projectMedia.create({
        data: { projectId: project.id, mediaId: media.id, role: 'blueprint', sortOrder: order++ },
      });
    }

    // Default SEO metadata, generated by TEMPLATE not AI -- seeding must not
    // require an API key. This is also a direct fix for the bug the plan
    // flagged: every project page currently shares one identical title.
    const metaTitle = `${d.name} — Ehsan Plant & Property`;
    const metaDescription = d.description.length > 155 ? d.description.slice(0, 152).trimEnd() + '…' : d.description;
    const scored = evaluateSeo({
      title: metaTitle, description: metaDescription, slug: card.reference,
      focusKeyword: null, bodyText: d.description,
      imageCount: allImages.length, imagesWithAlt: 0,
      otherPublishedTitles: [], internalLinkCount: 0,
    });
    await prisma.seoMeta.upsert({
      where: { entityType_entityId_locale: { entityType: 'project', entityId: project.id, locale: 'EN' } },
      create: {
        entityType: 'project', entityId: project.id, locale: 'EN',
        metaTitle, metaDescription, score: scored.score, band: scored.band,
        scoreDetail: scored.rules as any, scoredAt: new Date(),
      },
      update: {},
    });
  }
  console.log(`✓ ${cards.length} projects imported`);
}

interface JsonEvent {
  id: string; title: string; category: string; date: string; dateTime: string;
  location: string; image: string; price: string; attendees: string; capacity: number;
  registered: number; description: string; agenda: unknown; speakers: unknown;
  highlights: unknown; relatedEvents: string[];
}

function parseEventStart(dateTime: string): Date {
  // "Sep 15, 2024 · 2:00 PM" -- built by fmtDateTime in lib/bridge.ts, so
  // parsing it back is just `new Date` on the same locale-formatted string
  // with the separator normalised to something Date can read.
  const cleaned = dateTime.replace('·', '').trim();
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function seedEvents() {
  const events = await readJson<Record<string, JsonEvent>>(path.join(SITE_DATA, 'events.json'));
  let i = 0;
  for (const [ref, e] of Object.entries(events)) {
    const event = await prisma.event.upsert({
      where: { reference: ref },
      create: {
        reference: ref, startsAt: parseEventStart(e.dateTime), capacity: e.capacity,
        registered: e.registered, isFree: e.price === 'FREE', priceText: e.price === 'FREE' ? null : e.price,
        heroImageUrl: e.image, relatedReferences: e.relatedEvents, sortOrder: i++,
        publishState: 'PUBLISHED', publishedAt: new Date(),
      },
      update: {},
    });

    await prisma.eventTranslation.upsert({
      where: { eventId_locale: { eventId: event.id, locale: 'EN' } },
      create: {
        eventId: event.id, locale: 'EN', slug: ref, title: e.title, category: e.category,
        location: e.location, description: e.description,
        agenda: e.agenda as any, speakers: e.speakers as any, highlights: e.highlights as any,
      },
      update: {},
    });

    const metaTitle = `${e.title} — Ehsan Plant & Property`;
    const metaDescription = e.description.length > 155 ? e.description.slice(0, 152).trimEnd() + '…' : e.description;
    const scored = evaluateSeo({
      title: metaTitle, description: metaDescription, slug: ref, focusKeyword: null,
      bodyText: e.description, imageCount: 1, imagesWithAlt: 0,
      otherPublishedTitles: [], internalLinkCount: e.relatedEvents.length,
    });
    await prisma.seoMeta.upsert({
      where: { entityType_entityId_locale: { entityType: 'event', entityId: event.id, locale: 'EN' } },
      create: {
        entityType: 'event', entityId: event.id, locale: 'EN',
        metaTitle, metaDescription, score: scored.score, band: scored.band,
        scoreDetail: scored.rules as any, scoredAt: new Date(),
      },
      update: {},
    });
  }
  console.log(`✓ ${Object.keys(events).length} events imported`);
}

interface AwardFixture { ref: string; img: string; name: string; desc: string; year: string }

async function seedAwards() {
  const awards = await readJson<AwardFixture[]>(path.join(SEED_DATA, 'awards.json'));
  let i = 0;
  for (const a of awards) {
    await prisma.media.upsert({
      where: { storageKey: `legacy:awards/${a.img}` },
      create: { storageKey: `legacy:awards/${a.img}`, filename: a.img, mimeType: 'image/png', bytes: 0 },
      update: {},
    });
    const media = await prisma.media.findUniqueOrThrow({ where: { storageKey: `legacy:awards/${a.img}` } });

    const award = await prisma.award.upsert({
      where: { reference: a.ref },
      create: {
        reference: a.ref, year: parseInt(a.year, 10), mediaId: media.id,
        sortOrder: i++, publishState: 'PUBLISHED',
      },
      update: {},
    });
    await prisma.awardTranslation.upsert({
      where: { awardId_locale: { awardId: award.id, locale: 'EN' } },
      create: { awardId: award.id, locale: 'EN', name: a.name, description: a.desc },
      update: {},
    });
  }
  console.log(`✓ ${awards.length} awards imported`);
}

interface TestimonialFixture { img: string; quote: string; author: string; role: string; group: string }

async function seedTestimonials() {
  const items = await readJson<TestimonialFixture[]>(path.join(SEED_DATA, 'testimonials.json'));
  let i = 0;
  for (const t of items) {
    const ref = `testi-${i + 1}`;
    await prisma.media.upsert({
      where: { storageKey: `legacy:placeholders/${t.img}` },
      create: { storageKey: `legacy:placeholders/${t.img}`, filename: t.img, mimeType: 'image/jpeg', bytes: 0 },
      update: {},
    });
    const media = await prisma.media.findUniqueOrThrow({ where: { storageKey: `legacy:placeholders/${t.img}` } });

    const testimonial = await prisma.testimonial.upsert({
      where: { reference: ref },
      create: {
        reference: ref, mediaId: media.id, sortOrder: i++,
        isPlaceholder: true, // disclosed on the live page today -- carried through, not hidden
        publishState: 'PUBLISHED',
      },
      update: {},
    });
    await prisma.testimonialTranslation.upsert({
      where: { testimonialId_locale: { testimonialId: testimonial.id, locale: 'EN' } },
      create: {
        testimonialId: testimonial.id, locale: 'EN', quote: t.quote,
        author: t.author, role: t.role, groupLabel: t.group,
      },
      update: {},
    });
  }
  console.log(`✓ ${items.length} testimonials imported (flagged isPlaceholder)`);
}

interface TextBlockFixture { key: string; label: string; kind: string; group: string; value: unknown }

async function seedTextBlocks() {
  const blocks = await readJson<TextBlockFixture[]>(path.join(SEED_DATA, 'text-blocks.json'));
  let i = 0;
  for (const b of blocks) {
    const block = await prisma.textBlock.upsert({
      where: { key: b.key },
      create: { key: b.key, label: b.label, kind: b.kind, group: b.group, sortOrder: i++ },
      update: { label: b.label, kind: b.kind, group: b.group },
    });
    await prisma.textBlockTranslation.upsert({
      where: { textBlockId_locale: { textBlockId: block.id, locale: 'EN' } },
      create: { textBlockId: block.id, locale: 'EN', value: b.value as any },
      update: {},
    });
  }
  console.log(`✓ ${blocks.length} text blocks imported`);
}

async function main() {
  console.log('Seeding…\n');
  await seedRbac();
  await seedOwner();
  await seedProjects();
  await seedEvents();
  await seedAwards();
  await seedTestimonials();
  await seedTextBlocks();
  console.log('\nDone.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
