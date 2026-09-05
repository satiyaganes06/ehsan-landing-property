# Ehsan admin — panel UI

The admin panel's frontend, rebuilt on Next.js. Replaces `admin/web` (the Vite SPA),
which stays in the repo until this reaches feature parity and is then deleted in one
commit.

The Fastify API in `admin/` is unchanged and remains its own service. This app talks to
it through a proxy rewrite, so the browser only ever sees one origin — which is what lets
the session cookie and the preview iframe work without CORS or third-party-cookie
problems.

## Running it

Three processes. From `admin/`:

```bash
npm run db:up      # postgres
npm run dev        # API on :4000
```

Then from `admin/web/`:

```bash
npm run dev        # panel on :3000
```

Open http://localhost:3000. The seed script's owner login is printed by
`npm run db:seed` in `admin/`.

`API_ORIGIN` overrides the proxy target (default `http://localhost:4000`).

## Stack

Next.js 16 (App Router) · Tailwind v4 · animate-ui on Radix, with shadcn/ui for the
data and form layer · TanStack Query v5 · TanStack Table v8 · next-themes · sonner.

Components are generated into `components/` and owned by this repo — edit them directly.
`components/animate-ui/` holds the animated primitives, `components/ui/` the rest.

## Design tokens

`app/globals.css` derives everything from the live site's own stylesheet
(`css/content.css`): brass `rgb(235 242 18)`, warm near-black `#12110d`, and the site's
three faces — Fraunces for display, Archivo for UI, Azeret Mono for data.

Brass is a **shape** colour. It sits near white in luminance, so text set in it fails
contrast on light ground; `--brass-ink` carries type and `--brass-line` carries strokes.
The semantic ramp is the brand's own rather than a generic green/amber/red — brass means
good, sand means needs-a-look, rust means poor — so a published record and a passing SEO
score read as the same idea.

Light and dark are both first-class. The sidebar deliberately holds the site's dark
register in both.

## The five UX rules

Every screen honours these; they are the point of the rebuild.

1. **Loading is shaped.** Skeletons match the real layout. Refetches never blank the screen.
2. **Errors are visible and recoverable.** `ErrorState` explains and offers a retry; a 401
   anywhere triggers exactly one redirect to login; a 403 gets its own state.
3. **Every action acknowledges.** Pending spinners, disabled-while-in-flight, toasts that
   name what happened.
4. **Empty is designed.** Lists distinguish "no records yet" from "no results for this
   filter". Never a blank region.
5. **Editing is safe.** Dirty tracking, an unsaved-changes indicator, a leave warning, and
   ⌘S to save.

A corollary worth knowing about: `components/animate-ui/primitives/radix/tabs.tsx` is
locally patched so tab panels mount at their settled state instead of fading in from
`opacity: 0`. Motion's frame loop pauses while the document is hidden, so a panel mounted
in a background tab would otherwise stay invisible. Content must never be gated behind an
animation completing.

## Permissions

`lib/permissions.ts` mirrors the API's matrix for UX only — the server re-checks
everything. Navigation **hides** what a role cannot read; actions **disable with a
tooltip** when a role can read but not write, because a missing button reads as a broken
panel.

## Built so far

Every screen the sidebar links to:

- **Login**, **dashboard**
- **Projects** — list, create, and a tabbed workspace (content, images, search listing, preview)
- **Events** — the same three screens, sharing the Projects components
- **Awards** and **Testimonials** — card/list views with a Sheet editor, including create
- **Page text** — the landing page's fixed copy, grouped by section in scroll order
- **Media** — grid, upload, per-image description, missing-description filter
- **Enquiries** — inbox with optimistic status changes and CSV export
- **Users & roles** — accounts, role assignment, and a plain-language role reference
- **Activity log** — the audit trail, in sentences rather than event codes

Not yet built: the AI suggestion controls (`/api/ai/*` — meta, keywords, rewrite, alt
text, internal links), the revision-history tab, and the Malay locale switcher. The API
supports all three; they are UI work only.
