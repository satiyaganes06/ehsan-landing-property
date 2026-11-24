# Ehsan Plant & Property — landing site

Static site. No build step, no dependencies. Serve the folder and open it:

```sh
node tools/build-public-pages.mjs
python3 tools/serve.py --port 8899
# → http://localhost:8899
```

A server is required rather than opening the files directly: the event and
project pages read their content from `data/*.json` over `fetch`, which the
`file://` protocol blocks.

Public URLs use `/about`, `/projects`, `/projects/ehsan-widuri`, `/events/<slug>`,
`/news/<slug>` and `/project-licensing/`. The local server resolves published
CMS slugs (including new projects) and permanently redirects legacy HTML links
when run as `python3 tools/serve.py --port 8899`. The standard static server also
works with generated indexes; legacy links redirect in the browser.
For hosting, use the included root `vercel.json` or Apache `.htaccess`; legacy
detail links also resolve their record and redirect in the browser. Deploy the
public repository root separately from the admin app. Admin URLs are unchanged.

## Search and share previews

Vercel renders the detail pages, news and event archive links, and sitemap from the published feeds. Set `EHSAN_CMS_ORIGIN` to use the live CMS. Without it, the routes use the bundled public records.

For static or Apache hosting, run `node tools/build-public-pages.mjs` after content updates and include the generated detail directories and sitemap in the deployment. Remove obsolete generated pages when a record changes slug or is unpublished. Use a clean build directory for each release.

## Company Facts

Editors with content update access can publish the company profile and buyer questions from **Company Facts** in the admin sidebar. Project details come from published portfolio records. The public URL is `/ai-instructions/`; the CMS serves the full HTML at `/api/public/company-facts`.

For separate Vercel deployments, set `EHSAN_CMS_ORIGIN` on the public website to the HTTPS origin of the admin deployment. Without that setting the website serves the bundled HTML snapshot. For a VPS, proxy the public URL to the CMS HTML endpoint or serve the shared website directory with the admin’s local publishing mirror.

## Layout

```
index.html          the landing page — stays at the root so "/" resolves to it
html/               every other page
css/                stylesheets
js/                 page behaviour, one file per page + shared content.js
components/         shared page chrome (navbar, footer, assistant)
data/               content the pages fetch at runtime
assets/             images, logo, video, and the hero frame sequences
tools/              cut-frames.sh, which regenerates assets/frames-hd
```

| Page | Stylesheet | Script | Data |
| --- | --- | --- | --- |
| `index.html` | `css/style.css`, `css/content.css` | `js/app.js` | — |
| `html/about.html` | + — | `js/about.js` | — |
| `html/events.html` | + `css/events.css` | `js/events.js` | `data/events.json` |
| `html/event-detail.html` | + `css/event-detail.css` | `js/event-detail.js` | `data/events.json` |
| `html/project-detail.html` | + `css/project-detail.css` | `js/project-detail.js` | `data/projects.json` |

`css/style.css` and `css/content.css` load on every page — the first owns the
design tokens and the hero stage, the second everything below it. `js/content.js`
likewise runs everywhere, which is what powers the assistant widget and the
shared reveal behaviour.

## Components

The navbar, footer and assistant used to be copy-pasted into all five pages.
They now live in `components/`, one file each, and every page drops in a
placeholder where the markup should go:

```html
<div data-component="navbar"></div>
```

The scripts at the foot of each page mount them, in this order:

```html
<script src="components/registry.js"></script>   <!-- creates window.SITE -->
<script src="components/navbar.js"></script>     <!-- SITE.define('navbar', …) -->
<script src="components/footer.js"></script>
<script src="components/assistant.js"></script>
<script src="components/mount.js"></script>      <!-- fills every placeholder -->

<script src="js/app.js"></script>                <!-- page behaviour, after -->
```

Order is not incidental. `mount.js` injects synchronously at the end of `<body>`,
so `js/content.js` still finds `[data-assistant]` in the DOM exactly as it did
when the markup was hand-written into the page.

### Adding a component

Create `components/thing.js`:

```js
SITE.define('thing', (SITE) => `<div class="thing">…</div>`);
```

Add `<script src="components/thing.js"></script>` **before** `mount.js`, and put
`<div data-component="thing"></div>` where it should render.

### Paths

`registry.js` derives `SITE.base` — the absolute URL of the project root — from
its own `src`, not from the document. That is what lets one navbar definition
serve both `index.html` at the root and the pages inside `html/`. Anything
resolved against the project root goes through `SITE.url()`:

```js
SITE.url('data/events.json')   // → <root>/data/events.json, from any page
```

Use it for cross-page links, fetches, and image paths built in JavaScript.
Paths written directly in a page's own HTML stay plain relative (`../css/…`).
# Content snapshots

Admin content is stored in the database, not in Git. To export the current
content (with the local admin running on port 3001), run from
`ehsan-property-admin`:

```sh
node --env-file=.env --env-file=.env.local scripts/content-snapshot.cjs export
```

This writes `data/content-snapshot.json` in the admin and refreshed public
JSON files in the root `data/` directory. Public uploads are also copied to
`assets/img/admin-uploads/`. Accounts, passwords, sessions, enquiries,
analytics and audit records are deliberately excluded. Removed testimonials
are not exported. The website uses the public landing snapshot when the admin
service is unavailable; sending enquiries still needs the admin service.

To restore the reviewed content snapshot into a configured admin database:

```sh
node --env-file=.env --env-file=.env.local scripts/content-snapshot.cjs restore --apply
```

Back up the destination first: this updates matching content records without
deleting unrelated records or changing accounts. Configure environment files
and run database migrations separately. Pushing to GitHub does not restore a
deployed database automatically. Local media uploads in the admin `uploads/`
directory must also be available for editing uploaded images.

## Search performance

With a Google OAuth access token for the verified Ehsan property (scope `https://www.googleapis.com/auth/webmasters.readonly`) in `GSC_ACCESS_TOKEN`, run:

```sh
python3 tools/search-opportunities.py
python3 tools/search-opportunities.py --page https://ehsanproperty.com/projects/ehsan-widuri
```

The first command reports up to ten query/page pairs from a 90-day window, ordered by impressions. It uses English and Malay property terms as a proxy for buyer interest and excludes Ehsan and portfolio names. Defaults are at least 100 impressions and at most 1% CTR; adjust with `--min-impressions` and `--max-ctr-percent`. The second command keeps branded and already-performing queries for the specified page. Set `--end YYYY-MM-DD` to reproduce a reporting window. Review the actual queries before choosing a title. Compare the same query and URL across equal windows after deployment.

## Answer-engine citation checks

Use the published page as the source when checking an answer. Example buyer questions include “Where is Ehsan Widuri?”, “How do I verify a project’s developer licence?” and “How can I arrange a viewing with Ehsan Property?” Record the exact question, answer engine, observation date and Ehsan URL only when the response actually links to that page.

The installed AEO toolkit runs with Python 3.10 or later. From the repository root, use these commands for a content audit and a citation report. The report reads observations from the current user's local ledger.

```sh
python3.13 .agents/skills/aeo/scripts/aeo_audit.py --input ai-instructions/index.html --industry b2b
python3.13 .agents/skills/aeo/scripts/citation_tracker.py --action report --url https://ehsanproperty.com/ai-instructions/
```

To log an observed citation, use the tracker's `--action add` with `--url`, `--llm`, `--query` and `--date`. The audit score is a text heuristic. Use the citation ledger to measure actual citations.
