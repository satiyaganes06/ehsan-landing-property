/**
 * Copies html/project-detail.html and html/event-detail.html out of the static
 * site and into public/preview/, rewriting them for use inside the panel.
 *
 * Three changes are made, and nothing else -- the markup itself stays byte for
 * byte identical so the preview cannot drift from the real page:
 *
 *   1. Relative asset paths (../css, ../js, ../components, ../index.html) are
 *      repointed at /live-site/, which the Next rewrite proxies to the API's
 *      read-only static mount of the repo root. components/registry.js derives
 *      SITE.base from its own script src, so loading it from /live-site/ makes
 *      every image and data path the page builds resolve correctly too.
 *
 *   2. A shim is injected into <head> that parks any fetch of
 *      data/projects.json or data/events.json until the panel posts the draft
 *      record in. Without it the page would render the PUBLISHED content and
 *      the preview would not show unsaved edits.
 *
 *   3. The registration form on the event page is made inert, so nobody can
 *      submit a real enquiry from a preview.
 *
 * Re-run with: npm run sync:preview
 */
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const REPO = path.resolve(APP, '..');

const SHIM = `<script>
/* Injected by scripts/sync-preview-templates.mjs -- do not edit here. */
(function () {
  var resolveDraft;
  var draft = new Promise(function (resolve) { resolveDraft = resolve; });

  window.addEventListener('message', function (event) {
    if (event.source !== window.parent) return;
    if (!event.data || event.data.type !== 'ehsan:preview-data') return;
    resolveDraft(event.data.payload);
  });

  /* The page fetches its own data file on load. Park that request until the
     panel hands over the draft, so the published copy is never rendered
     first and then replaced -- the reader would see it flash. */
  var realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (/\\/data\\/(projects|events)\\.json/.test(url)) {
      return draft.then(function (payload) {
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      });
    }
    return realFetch(input, init);
  };

  function announceReady() {
    if (window.parent === window) return;
    window.parent.postMessage({ type: 'ehsan:preview-ready' }, window.location.origin);
  }
  announceReady();
  window.addEventListener('load', announceReady);
})();
</script>
`;

const INERT_FORM = `<script>
/* Preview only: the registration form must not reach the real endpoint. */
document.addEventListener('submit', function (event) {
  if (event.target && event.target.id === 'eventRegisterForm') {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);
</script>
`;

/** Repoint the page's relative paths at the proxied copy of the site. */
function rewritePaths(html) {
  return html
    .replace(/(href|src)="\.\.\/(css|js|components|assets|data)\//g, '$1="/live-site/$2/')
    .replace(/(href|src)="\.\.\/index\.html/g, '$1="/live-site/index.html');
}

function injectIntoHead(html, ...blocks) {
  return html.replace('</head>', `${blocks.join('')}</head>`);
}

const TARGETS = [
  { from: 'html/project-detail.html', to: 'public/preview/project.html', extra: [] },
  { from: 'html/event-detail.html', to: 'public/preview/event.html', extra: [INERT_FORM] },
];

await mkdir(path.join(APP, 'public/preview'), { recursive: true });

/* The preview loads the site's real CSS, JS and images from /live-site/.
   Fastify used to serve those straight from the repo; with the API gone they
   are copied into public/ so they deploy with the app and cannot break
   because the landing site was redeployed separately. */
const SITE_DIRS = ['css', 'js', 'components', 'assets'];
const LIVE_SITE = path.join(APP, 'public/live-site');

await rm(LIVE_SITE, { recursive: true, force: true });
for (const dir of SITE_DIRS) {
  await cp(path.join(REPO, dir), path.join(LIVE_SITE, dir), { recursive: true });
  console.log(`${dir}/ -> public/live-site/${dir}/`);
}

for (const target of TARGETS) {
  const source = await readFile(path.join(REPO, target.from), 'utf8');
  const output = injectIntoHead(rewritePaths(source), SHIM, ...target.extra);
  await writeFile(path.join(APP, target.to), output, 'utf8');
  console.log(`${target.from} -> ${target.to}`);
}
