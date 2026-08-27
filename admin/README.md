# Ehsan admin

A full admin panel for the Ehsan Plant & Property landing page: RBAC, content management
for projects/events/awards/testimonials/page text, an SEO suite with a deterministic
score engine, live preview against the production templates, an enquiries inbox, a
dashboard, and AI-assisted SEO suggestions. Standalone from the public site — nothing in
the static site's HTML/CSS/JS was touched, so the prototype can still be demoed while
this runs alongside it.

## Running it

```bash
cp .env.example .env          # then set SESSION_SECRET to 32+ random bytes
npm install
npm run db:up                 # postgres in docker
npm run db:push               # apply the schema
npm run db:seed               # imports the site's existing content -- prints the
                               # generated owner login on first run, save it
npm run dev                   # backend on :4000

cd web
npm install
npm run dev                   # frontend on :5173, proxies /api to :4000
```

Open http://localhost:5173, sign in with the credentials `db:seed` printed.

## What got built

- **RBAC** — five roles (owner/admin/editor/contributor/viewer) over a resource×action
  permission matrix (`src/lib/permissions.ts`), enforced at the route layer
  (`requirePermission`) and, for the Contributor role's "own records only" rule, at the
  row level (`src/lib/ownership.ts`) — a restriction the flat matrix can't express on its
  own. An append-only audit log records every write.
- **Content management** — projects, events, awards, testimonials, and the page's other
  copy (hero, prelude, doctrine, commitments, contact) as typed text blocks rather than a
  page builder, since the landing page's scroll choreography depends on section order.
  Every save snapshots a revision.
- **SEO** — per-record meta title/description/canonical/robots/OG fields, focus keyword,
  and an 11-rule deterministic score (`src/lib/seo-score.ts`) that bands BAD/NEUTRAL/GOOD.
  Deterministic on purpose: AI suggests, the rules grade, and a score that moved between
  runs would be a score nobody trusted.
- **Live preview** — renders the actual `html/project-detail.html` /
  `html/event-detail.html` files with a fetch shim that swaps in unsaved draft content
  (`src/modules/preview/routes.ts`). Same template, same CSS, same JS as production —
  not a reimplementation that would drift from the real site within a month.
- **Dashboard** — needs-attention (low SEO scores, missing alt text), publish state,
  enquiry trend, upcoming events, activity feed.
- **Enquiries** — a real endpoint. The live site's contact form currently discards every
  submission (`content.js` reports "this is a placeholder form" and sends nothing); this
  is the backend it needs, with honeypot + timing + rate-limit spam defence and PDPA
  consent capture. Wiring the site's `<form>` to POST here is a small frontend change,
  intentionally left for the Astro migration rather than done piecemeal here.
- **AI** — five SEO tasks (meta, keywords, rewrite-to-pass, alt text, internal links)
  behind a provider-swappable abstraction. See below.

## Swapping the AI provider

```diff
- AI_PROVIDER=openrouter
+ AI_PROVIDER=anthropic
+ ANTHROPIC_API_KEY=sk-ant-...
```

Nothing else changes. Every task in `src/ai/tasks/` declares a Zod schema and a prompt;
`getAi()` resolves whichever adapter the environment names. The seam is structured
output — OpenRouter takes OpenAI-style `response_format.json_schema` (converted from Zod
via `z.toJSONSchema()`), Anthropic takes `output_config.format` via `zodOutputFormat`.
Free-model quirks (JSON wrapped in prose or a fence) are handled only in the OpenRouter
adapter, so production never inherits demo-provider workarounds.

```bash
npm run ai:smoke    # verify the configured provider end to end
```

## Bahasa Melayu

Built in from the schema up, not retrofitted: structural facts (coordinates, capacity,
GDV, dates) live on the base row, translated content lives in a per-locale side table
(`project_translations`, `event_translations`, `text_block_translations`, …) with its own
slug — so the Malay site gets Malay URLs, not English ones under a `/ms` prefix. The
panel's own UI is English-only for now; content in both locales is fully modelled and
editable via `PUT /api/projects/:id/translations/MS` (and the equivalent event/award/
testimonial/block routes) even though the current React screens only expose EN. Adding a
locale switcher to the panel is UI work on an already-complete data layer.

## The content bridge

The site reads `data/projects.json` and `data/events.json` at runtime
(`js/project-detail.js`, `js/event-detail.js`, `js/events.js`). Publishing from this panel
regenerates those two files, atomically, in their existing shape — so the CMS drives the
live site with zero frontend changes. `src/lib/bridge.ts` deliberately does NOT touch the
homepage's project cards or commitment section: those are hardcoded HTML in `index.html`
today, not data-driven, and rewriting embedded page markup from the database is the
Astro migration's job, not this one's.

## What's stubbed or deferred, on purpose

- **Cloudflare Turnstile** — the enquiries endpoint has honeypot + timing + rate-limit
  defence, but Turnstile needs a site key wired into the (not-yet-migrated) frontend
  form; adding only the server half would be unverifiable.
- **Transactional email on new enquiry** — the endpoint is marked with a `TODO`; wiring
  Resend/Postmark is a few lines once an API key exists.
- **Search Console integration** — dashboard returns `{ enabled: false }`; this was
  Phase 8 in the build plan, after the site is live and indexed.
- **A locale switcher in the panel UI** — see Bahasa Melayu above.

## Verifying without a live database

This sandbox could not reach Docker Hub, so the schema and every route were verified
without ever running Postgres:

- `npx prisma validate` + `prisma migrate diff --from-empty` — schema is valid, DDL
  generates cleanly (25 tables, 5 enums, 28 indexes, 18 FKs).
- `buildServer()` boots and registers all 70 route handlers across 12 modules with zero plugin
  or wiring errors, checked independent of any database connection.
- The SEO score engine, pixel-width heuristic, and date round-trip logic were exercised
  directly against real numbers (see conversation history) — including confirming that
  the site's actual current bug (16 project pages sharing one title) scores BAD as
  expected.
- Every seed fixture (`prisma/seed-data/*.json`, extracted from the live `index.html`)
  was cross-referenced against `data/projects.json` / `data/events.json` and the files
  on disk they point at — no missing images, no orphaned references.
- Backend and frontend both typecheck clean; `npm run build` in `web/` produces a clean
  production bundle.

Run `npm run db:up && npm run db:push && npm run db:seed` on a machine with Docker Hub
access to complete the one check this sandbox couldn't perform.
