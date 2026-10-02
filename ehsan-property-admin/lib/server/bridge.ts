/* ---------------------------------------------------------------------------
   Content bridge.

   The static site fetches data/projects.json and data/events.json at runtime
   (js/project-detail.js, js/event-detail.js, js/events.js). This module
   regenerates those two files from the database, in their EXISTING shape, so
   the panel drives the live site with zero frontend changes.

   Deliberately narrow scope: the homepage's project cards and commitment
   section are hardcoded HTML in index.html today, not read from JSON, so this
   bridge does not touch them -- rewriting embedded page markup from the
   database is the Astro migration's job, not this one's. This writes exactly
   the two files the site already reads dynamically, in exactly the shape
   js/project-detail.js and js/event-detail.js already expect.

   Only PUBLISHED records are written. A draft never reaches the live file --
   that boundary is what makes "Publish" mean something.

   Writes are atomic (temp file + rename) so a build that dies mid-write can
   never leave the live site reading a truncated JSON file.
   --------------------------------------------------------------------------- */

import { writeFile, rename, mkdir, readFile } from 'node:fs/promises';
import { slugify } from './slug';
import { readFeaturedProjects } from './featured-projects';
import path from 'node:path';
import 'server-only';
import { prisma } from './prisma';
import { mediaUrl } from './media-url';
import { projectEnquirySchema, projectEnquiryKey } from './project-enquiry';

/* Where the landing site reads its content from. Relative to the app root,
   which is one level below the repo root now that the panel sits there.
   Phase 4 replaces this whole file with public JSON routes -- Vercel has no
   writable disk, so publishing cannot keep writing files. */
const DATA_DIR = path.resolve(process.env.SITE_DATA_DIR ?? '../data');

async function writeJsonAtomic(filename: string, data: unknown): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const finalPath = path.join(DATA_DIR, filename);
  const tmpPath = `${finalPath}.tmp-${process.pid}`;
  await writeFile(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  await rename(tmpPath, finalPath);
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'Asia/Kuala_Lumpur' }).format(d);
}
function fmtDateTime(d: Date): string {
  const date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }).format(d);
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kuala_Lumpur' }).format(d);
  return `${date} · ${time}`;
}

/**
 * Image path for the published site payload.
 *
 * The site's own scripts do SITE.url(`assets/img/${name}`), so a legacy image
 * must stay a bare name relative to assets/img -- emitting a full URL here is
 * what produced `assets/img//media/legacy/img/...` on the live site, and what
 * corrupted the media table when a later seed read those values back as
 * filenames.
 *
 * Uploads and blobs have no home under assets/img, so they emit an absolute
 * URL and the site's scripts pass anything starting with "/" or "http"
 * through untouched.
 */
function siteImagePath(storageKey: string): string {
  if (storageKey.startsWith('legacy:')) {
    return storageKey.slice('legacy:'.length).replace(/^img\//, '');
  }
  return mediaUrl(storageKey);
}

export async function buildProjectsPayload(): Promise<Record<string, unknown>> {
  const featured = await readFeaturedProjects();
  const projects = await prisma.project.findMany({
    where: { publishState: 'PUBLISHED' },
    orderBy: { sortOrder: 'asc' },
    include: {
      translations: { where: { locale: 'EN' } },
      media: { orderBy: { sortOrder: 'asc' }, include: { media: true } },
    },
  });

  const enquiryBlocks = await prisma.textBlock.findMany({ where: { key: { in: projects.flatMap(p => [projectEnquiryKey(p.reference), `project.content.${p.reference}`]) } }, include: { translations: { where: { locale: 'EN' } } } });
  const enquiryByKey = new Map(enquiryBlocks.map(block => [block.key, block.translations[0]?.value]));
  const out: Record<string, unknown> = {};
  for (const p of projects) {
    const t = p.translations[0];
    if (!t) continue; // no EN copy yet -- not ready to publish, skip rather than emit blanks

    out[p.reference] = {
      featured: featured.includes(p.reference),
      sortOrder: p.sortOrder,
      createdAt: p.createdAt.toISOString(),
      name: t.name,
      slug: /^proj-\d+$/.test(t.slug) ? slugify(t.name) : t.slug,
      ...(p.reference !== 'proj-15' && enquiryByKey.has(`project.content.${p.reference}`) ? { content: enquiryByKey.get(`project.content.${p.reference}`) } : {}),
      enquiry: projectEnquirySchema.parse(enquiryByKey.get(projectEnquiryKey(p.reference)) ?? { enabled: false, interest: '' }),
      location: t.location,
      coordinates: p.latitude != null && p.longitude != null ? { lat: p.latitude, lng: p.longitude } : null,
      year: p.yearStart ?? '',
      yearEnd: p.yearEnd ?? '',
      status: p.status === 'COMPLETED' ? 'Completed' : p.status === 'ONGOING' ? 'Ongoing' : 'Future',
      description: t.description,
      units: p.units ?? '',
      area: p.areaText ?? '',
      priceRange: p.priceRange ?? '',
      occupancy: p.occupancy ?? '',
      amenities: t.amenities,
      certificate: t.certificate ?? null,
      media: {
        thumbnail: (() => { const image = p.media.find(m => m.role === 'thumbnail') || p.media.find(m => m.role === 'hero' || m.role === 'gallery'); return image ? siteImagePath(image.media.storageKey) : null; })(),
        image: p.media.filter((m) => m.role === 'gallery' || m.role === 'hero').map((m) => siteImagePath(m.media.storageKey)),
        blueprint: p.media.filter((m) => m.role === 'blueprint').map((m) => siteImagePath(m.media.storageKey)),
        ...(p.reference !== 'proj-15' ? Object.fromEntries(['logo', 'location', 'shuttle', 'facilities', 'interior'].map(role => [role, p.media.filter(m => m.role === role).map(m => siteImagePath(m.media.storageKey))])) : {}),
      },
    };
  }

  return out;
}

export async function buildEventsPayload(): Promise<Record<string, unknown>> {
  const events = await prisma.event.findMany({
    where: { publishState: 'PUBLISHED' },
    orderBy: { sortOrder: 'asc' },
    include: { translations: { where: { locale: 'EN' } }, heroMedia: true },
  });

  const out: Record<string, unknown> = {};
  for (const e of events) {
    const t = e.translations[0];
    if (!t) continue;

    out[e.reference] = {
      id: e.reference,
      title: t.title,
      slug: /^event-\d+$/.test(t.slug) ? slugify(t.title) : t.slug,
      category: t.category,
      date: fmtDate(e.startsAt),
      dateTime: fmtDateTime(e.startsAt),
      location: t.location,
      image: e.heroMedia ? mediaUrl(e.heroMedia.storageKey) : (e.heroImageUrl ?? ''),
      price: e.isFree ? 'FREE' : (e.priceText ?? ''),
      attendees: e.capacity != null ? `${e.capacity} Attendees` : '',
      capacity: e.capacity ?? 0,
      registered: e.registered,
      description: t.description,
      agenda: t.agenda,
      speakers: t.speakers,
      highlights: t.highlights,
      relatedEvents: e.relatedReferences,
    };
  }

  return out;
}

/**
 * Mirrors a payload onto disk for the static site to read directly.
 *
 * Best-effort by design. The live source of truth is now
 * /api/public/projects.json and /api/public/events.json, built from the
 * database on request. Vercel's filesystem is read-only, so this simply does
 * nothing there -- publishing must not fail because a convenience copy could
 * not be written.
 */
async function mirrorToDisk(filename: string, data: unknown): Promise<boolean> {
  try {
    await writeJsonAtomic(filename, data);
    // Local static servers need a real index for new published clean URLs.
    // Deployed hosts use the supplied rewrites instead (read-only filesystem).
    const kind = filename === 'projects.json' ? 'projects' : 'events';
    const template = await readFile(path.join(DATA_DIR, '..', 'html', `${kind === 'projects' ? 'project' : 'event'}-detail.html`), 'utf8');
    for (const record of Object.values(data as Record<string, {slug?: string}>)) {
      if (!record.slug || !/^[a-z0-9-]+$/.test(record.slug)) continue;
      const directory = path.join(DATA_DIR, '..', kind, record.slug);
      await mkdir(directory, {recursive:true}); await writeFile(path.join(directory, 'index.html'), template);
    }
    return true;
  } catch {
    return false;
  }
}

export async function rebuildProjectsJson(): Promise<{ count: number; mirrored: boolean }> {
  const out = await buildProjectsPayload();
  return { count: Object.keys(out).length, mirrored: await mirrorToDisk('projects.json', out) };
}

export async function rebuildEventsJson(): Promise<{ count: number; mirrored: boolean }> {
  const out = await buildEventsPayload();
  return { count: Object.keys(out).length, mirrored: await mirrorToDisk('events.json', out) };
}
