/* -------------------------------------------------------------------------
   components/registry.js — the shared component runtime.

   Every file in this folder registers ONE piece of page chrome here. A
   component is just a function that receives the site base URL and returns a
   markup string; registry.js keeps the list and mount.js does the injecting.

   Loading this file also resolves SITE.base — the absolute URL of the project
   root, derived from this script's own src rather than from the document. That
   is what lets a page in /html/ and the page at / share one navbar without
   either of them hardcoding "../".
   ------------------------------------------------------------------------- */

(() => {
  const src = document.currentScript.src;
  const base = src.slice(0, src.indexOf('/components/') + 1);

  // Filename of the page currently being viewed, e.g. "about.html".
  // A bare directory URL ("/" or "/html/") means the index of that folder.
  const path = window.location.pathname;
  const page = path.slice(path.lastIndexOf('/') + 1) || 'index.html';

  window.SITE = {
    /** Absolute URL of the project root, always with a trailing slash. */
    base,

    /** Current page filename, lowercased — components use it for active state. */
    page: page.toLowerCase(),

    /** Resolve a project-root-relative path: SITE.url('data/events.json'). */
    url: (relative) => base + String(relative).replace(/^\/+/, ''),

    /** name -> (SITE) => markup string */
    components: {},

    /** Called by each component file at load time. */
    define(name, render) {
      this.components[name] = render;
    },
  };
})();
