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
  const dropdownStyle = document.createElement('link'); dropdownStyle.rel = 'stylesheet'; dropdownStyle.href = base + 'css/modern-select.css?v=20261002.43'; document.head.append(dropdownStyle);
  const dropdownScript = document.createElement('script'); dropdownScript.src = base + 'js/modern-select.js?v=20261002.51'; document.head.append(dropdownScript);

  // Filename of the page currently being viewed, e.g. "about.html".
  // A bare directory URL ("/" or "/html/") means the index of that folder.
  const path = window.location.pathname;
  const route = path.replace(/\/$/, '').split('/').filter(Boolean);
  const sections = { about: 'about.html', projects: 'projects.html', events: 'events.html', news: 'news.html', 'project-licensing': 'project-licensing' };
  const page = Object.hasOwn(sections, route[0]) ? (route.length > 1 && ['projects','events','news'].includes(route[0]) ? `${route[0] === 'projects' ? 'project' : route[0] === 'events' ? 'event' : 'news'}-detail.html` : sections[route[0]]) : path.slice(path.lastIndexOf('/') + 1) || 'index.html';
  if (window.parent === window && !new URLSearchParams(location.search).has('landing-editor')) {
    const legacy = path.match(/\/html\/(about|projects|events|news)\.html$/);
    if (legacy) location.replace(base + legacy[1] + location.search + location.hash);
    else if (path === '/index.html') location.replace(base + location.search + location.hash);
  }

  // Keep the latest identifiable arrival in this tab across internal navigation.
  const utm = {};
  const params = new URLSearchParams(location.search);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const value = params.get(key)?.trim();
    if (value) utm[key] = value.slice(0, 200);
  }
  let referralOrigin;
  if (document.referrer) {
    try {
      const previous = new URL(document.referrer);
      if (previous.origin !== location.origin && /^https?:$/.test(previous.protocol)) referralOrigin = previous.origin;
    } catch { /* Ignore referrers that are not URLs. */ }
  }
  let attribution = { utm, referralOrigin };
  if (window.parent === window && !params.has('landing-editor')) {
    try {
      const key = 'ehsan.enquiry-attribution';
      if (Object.keys(utm).length || referralOrigin) sessionStorage.setItem(key, JSON.stringify(attribution));
      else attribution = JSON.parse(sessionStorage.getItem(key) || 'null') || attribution;
    } catch { /* Tracking is optional when browser storage is unavailable. */ }
  }

  window.SITE = {
    /** Absolute URL of the project root, always with a trailing slash. */
    base,
    enquiryAttribution: attribution,
    escapeHtml(value) {
      const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
      return String(value ?? '').replace(/[&<>"']/g, character => entities[character]);
    },
    /** Use the same CMS for every public page; never point production at localhost. */
    adminOrigin: (window.EHSAN_CMS_ORIGIN || (['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:3001' : location.origin)).replace(/\/$/, ''),

    /** Current page filename, lowercased — components use it for active state. */
    page: page.toLowerCase(),

    /** Resolve a project-root-relative path: SITE.url('data/events.json'). */
    url: (relative) => base + String(relative).replace(/^\/+/, ''),

    /** name -> (SITE) => markup string */
    components: {},

    slug: record => String(record.slug || record.name || record.title || record.id || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0,80),
    async loadEvents() {
      try {
        const options = window.parent === window ? { signal: AbortSignal.timeout(3000) } : {};
        const response = await fetch(this.adminOrigin + '/api/public/events.json', options);
        if (!response.ok) throw new Error('Event service unavailable');
        return await response.json();
      } catch (error) {
        if (window.parent !== window) throw error;
        const response = await fetch(this.url('data/events.json'));
        if (!response.ok) throw new Error('Event snapshot unavailable');
        return response.json();
      }
    },
    recordUrl(kind, record) { return this.url(`${kind}/${this.slug(record)}`); },
    recordId(kind, records) {
      const query = new URLSearchParams(location.search).get(kind === 'projects' ? 'project' : kind === 'events' ? 'event' : 'news');
      if (query) return query.replace(/[.,;]+$/, '');
      const slug = route[0] === kind ? route[1] : null;
      return slug ? Object.keys(records).find(id => this.slug(records[id]) === slug) : null;
    },
    canonical(kind, record) {
      if (window.parent !== window || new URLSearchParams(location.search).has('landing-editor') || /\/preview\//.test(path)) return;
      const url = this.recordUrl(kind, record);
      let link = document.querySelector('link[rel="canonical"]');
      if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.append(link); } link.href = /^https?:\/\//i.test(record.seo?.canonicalUrl || '') ? record.seo.canonicalUrl : url;
      if (/\/html\/.*-detail\.html$/.test(location.pathname)) {
        const destination = new URL(url);
        destination.search = location.search;
        destination.searchParams.delete({projects: 'project', events: 'event', news: 'news'}[kind]);
        destination.hash = location.hash;
        location.replace(destination.href);
      }
    },

    /** Called by each component file at load time. */
    define(name, render) {
      this.components[name] = render;
    },
  };
})();
