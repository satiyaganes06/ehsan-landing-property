# Ehsan Plant & Property — landing site

Static site. No build step, no dependencies. Serve the folder and open it:

```sh
python3 -m http.server 8899
# → http://localhost:8899
```

A server is required rather than opening the files directly: the event and
project pages read their content from `data/*.json` over `fetch`, which the
`file://` protocol blocks.

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
