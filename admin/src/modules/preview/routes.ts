/* ---------------------------------------------------------------------------
   Live preview.

   The design goal from the build plan: preview renders the PRODUCTION
   template, not a reimplementation of it -- a preview built from its own
   markup drifts from the real site within a month and then lies about what
   will actually publish.

   How this achieves that without an Astro migration: html/project-detail.html
   and html/event-detail.html already fetch their content client-side from
   data/projects.json / data/events.json (js/project-detail.js,
   js/event-detail.js). This route serves the SAME HTML FILE, byte-for-byte,
   with two things injected right after <head>:

     1. <base href=".../live-site/html/">  so every relative css/js/asset
        reference in the file resolves against the real site's own files,
        served statically by this same server (see server.ts's /live-site/
        mount) -- works fully offline, no deployed site required.

     2. A fetch shim that intercepts the ONE request project-detail.js makes
        for data/projects.json and answers it with a single-key JSON object
        containing this record's UNSAVED draft state, built server-side from
        the same shape src/lib/bridge.ts writes for the real file. Every
        other request (css, images, other scripts) passes through untouched.

   The homepage's project cards are hardcoded HTML, not data-driven (see
   lib/bridge.ts's own comment) -- there is no live "in-context on the
   homepage" preview to build without the deferred Astro migration. The card
   endpoint below is the honest alternative: it extracts the REAL .pcard
   markup structure and CSS and renders one card standalone, which is close
   but explicitly not the full scrolling page.
   --------------------------------------------------------------------------- */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../../lib/prisma.js';
import { requirePermission } from '../../lib/rbac.js';
import { mediaUrl } from '../../lib/media-url.js';
import { IdParamSchema, LocaleSchema } from '../../lib/validation.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../..');

function injectAfterHead(html: string, snippet: string): string {
  const idx = html.indexOf('<head>');
  if (idx === -1) return snippet + html; // defensive; every real page here has <head>
  const insertAt = idx + '<head>'.length;
  return html.slice(0, insertAt) + snippet + html.slice(insertAt);
}

function fetchShim(matchSuffix: string, payload: unknown): string {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c'); // guards the </script> boundary
  return `
<base href="/live-site/html/">
<script>
(function () {
  var DRAFT = ${json};
  var nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('${matchSuffix}') !== -1) {
      return Promise.resolve(new Response(JSON.stringify(DRAFT), { headers: { 'content-type': 'application/json' } }));
    }
    return nativeFetch(input, init);
  };
})();
</script>`;
}

export async function previewRoutes(app: FastifyInstance) {
  app.get('/api/preview/project/:id', { preHandler: requirePermission('project', 'read') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    const query = z.object({ locale: LocaleSchema.default('EN') }).safeParse(req.query);
    if (!params.success || !query.success) return reply.code(400).send({ error: 'bad_request' });

    const project = await prisma.project.findUnique({
      where: { id: params.data.id },
      include: {
        translations: { where: { locale: query.data.locale } },
        media: { orderBy: [{ role: 'asc' }, { sortOrder: 'asc' }], include: { media: true } },
      },
    });
    if (!project) return reply.code(404).send({ error: 'not_found' });
    const t = project.translations[0];
    if (!t) return reply.code(400).send({ error: 'bad_request', message: `No ${query.data.locale} content yet.` });

    const draft = {
      name: t.name, location: t.location,
      coordinates: project.latitude != null && project.longitude != null ? { lat: project.latitude, lng: project.longitude } : null,
      year: project.yearStart ?? '', status: project.status === 'COMPLETED' ? 'Completed' : project.status === 'ONGOING' ? 'Ongoing' : 'Future',
      description: t.description, units: project.units ?? '', area: project.areaText ?? '',
      priceRange: project.priceRange ?? '', occupancy: project.occupancy ?? '',
      amenities: t.amenities, certificate: t.certificate ?? null,
      media: {
        image: project.media.filter((m) => m.role !== 'blueprint').map((m) => `/live-site${mediaUrl(m.media.storageKey)}`),
        blueprint: project.media.filter((m) => m.role === 'blueprint').map((m) => `/live-site${mediaUrl(m.media.storageKey)}`),
      },
    };

    const html = await readFile(path.join(REPO_ROOT, 'html', 'project-detail.html'), 'utf8');
    const shimmed = injectAfterHead(html, fetchShim('data/projects.json', { [project.reference]: draft }));
    reply.header('X-Frame-Options', 'SAMEORIGIN'); // preview is meant for OUR iframe only
    reply.type('text/html');
    // The page reads ?project= from its own URL; forwarding it here keeps
    // getProjectFromURL() finding the same key the shim just injected.
    return reply.send(shimmed.replace('</head>', `<script>history.replaceState(null,'','?project=${project.reference}');</script></head>`));
  });

  app.get('/api/preview/event/:id', { preHandler: requirePermission('event', 'read') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    const query = z.object({ locale: LocaleSchema.default('EN') }).safeParse(req.query);
    if (!params.success || !query.success) return reply.code(400).send({ error: 'bad_request' });

    const event = await prisma.event.findUnique({
      where: { id: params.data.id },
      include: { translations: { where: { locale: query.data.locale } }, heroMedia: true },
    });
    if (!event) return reply.code(404).send({ error: 'not_found' });
    const t = event.translations[0];
    if (!t) return reply.code(400).send({ error: 'bad_request', message: `No ${query.data.locale} content yet.` });

    const draft = {
      id: event.reference, title: t.title, category: t.category,
      date: new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'Asia/Kuala_Lumpur' }).format(event.startsAt),
      dateTime: `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }).format(event.startsAt)} · ${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kuala_Lumpur' }).format(event.startsAt)}`,
      location: t.location,
      image: event.heroMedia ? `/live-site${mediaUrl(event.heroMedia.storageKey)}` : (event.heroImageUrl ?? ''),
      price: event.isFree ? 'FREE' : (event.priceText ?? ''),
      attendees: event.capacity != null ? `${event.capacity} Attendees` : '',
      capacity: event.capacity ?? 0, registered: event.registered,
      description: t.description, agenda: t.agenda, speakers: t.speakers, highlights: t.highlights,
      relatedEvents: event.relatedReferences,
    };

    const html = await readFile(path.join(REPO_ROOT, 'html', 'event-detail.html'), 'utf8');
    const shimmed = injectAfterHead(html, fetchShim('data/events.json', { [event.reference]: draft }));
    reply.header('X-Frame-Options', 'SAMEORIGIN');
    reply.type('text/html');
    return reply.send(shimmed.replace('</head>', `<script>history.replaceState(null,'','?event=${event.reference}');</script></head>`));
  });

  // Best-effort in-context preview: the real .pcard markup and CSS, one card,
  // standalone -- see the module comment for why this is not the full page.
  app.get('/api/preview/project/:id/card', { preHandler: requirePermission('project', 'read') }, async (req, reply) => {
    const params = IdParamSchema.safeParse(req.params);
    if (!params.success) return reply.code(400).send({ error: 'bad_request' });

    const project = await prisma.project.findUnique({
      where: { id: params.data.id },
      include: { translations: { where: { locale: 'EN' } }, media: { where: { role: 'gallery' }, take: 1, include: { media: true } } },
    });
    if (!project) return reply.code(404).send({ error: 'not_found' });
    const t = project.translations[0];
    if (!t) return reply.code(400).send({ error: 'bad_request', message: 'No English content yet.' });

    const tagText = project.occupancy || (project.status === 'COMPLETED' ? 'Completed' : project.status === 'ONGOING' ? 'On-going' : 'Future');
    const tagClass = project.status === 'COMPLETED' ? 'tag--done' : project.status === 'ONGOING' ? 'tag--live' : 'tag--next';
    const rm = project.gdvMillions != null ? `RM${Number(project.gdvMillions).toLocaleString('en-US', { maximumFractionDigits: 0 })}0,000` : 'RM TBA';
    const img = project.media[0] ? `/live-site${mediaUrl(project.media[0].media.storageKey)}` : '';
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

    const html = `<!doctype html>
<html><head><base href="/live-site/">
<link rel="stylesheet" href="css/style.css">
<link rel="stylesheet" href="css/content.css">
<style>body{background:var(--c-panel,#f6f6f0);padding:2.5rem;max-width:23rem}</style>
</head><body>
<article class="pcard">
  <div class="pcard__shot">
    <img src="${img}" alt="${esc(t.name)}">
    <span class="tag ${tagClass}">${esc(tagText)}</span>
  </div>
  <p class="pcard__yr">${esc(project.yearStart ?? '')}<small>${esc(project.yearEnd ?? '')}</small></p>
  <div class="pcard__body">
    <h4 class="pcard__name">${esc(t.name)}</h4>
    <p class="pcard__loc">${esc(t.location)}</p>
    <p class="pcard__desc">${esc(t.description)}</p>
  </div>
  <p class="pcard__rm"><i>RM</i>${rm.replace('RM', '')}</p>
  <span class="bar" style="--w:${project.barWeight ?? 0}"><i></i></span>
</article>
</body></html>`;

    reply.header('X-Frame-Options', 'SAMEORIGIN');
    reply.type('text/html');
    return reply.send(html);
  });
}
