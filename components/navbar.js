/* -------------------------------------------------------------------------
   components/navbar.js — the sticky top navigation.

   One definition for every page. Links are written project-root-relative and
   resolved through SITE.url(), so the same markup works from index.html at the
   root and from the pages inside /html/.

   `match` lists the pages a link owns, so the is-current highlight follows the
   visitor down into detail pages: reading a single project keeps "Work record"
   lit rather than dropping the highlight entirely. Links with no match are
   in-page anchors on the home page and never highlight.
   ------------------------------------------------------------------------- */

SITE.define('navbar', (SITE) => {
  const LINKS = [
    { label: 'Home',        href: 'index.html',         match: ['index.html'] },
    { label: 'About',       href: 'index.html#prelude', match: [] },
    { label: 'Work record', href: 'index.html#record',  match: ['project-detail.html'] },
    { label: 'Gallery',     href: 'index.html#gallery', match: [] },
    { label: 'Events',      href: 'index.html#events',  match: [] },
    { label: 'Contact',     href: 'index.html#contact', match: [] },
  ];

  const links = LINKS.map(({ label, href, match }) => {
    const current = match.includes(SITE.page) ? ' class="is-current"' : '';
    return `<a href="${SITE.url(href)}"${current}>${label}</a>`;
  }).join('\n    ');

  return `
<header class="topnav" id="topnav">
  <a class="topnav__brand" href="${SITE.url('index.html')}">
    <img src="${SITE.url('assets/logo/epp_logo.png')}" alt="Ehsan Plant &amp; Property logo" width="32" height="32" decoding="async">
    <span class="topnav__brand-full">Ehsan Plant &amp; Property</span>
  </a>
  <nav class="topnav__links" aria-label="Primary">
    ${links}
  </nav>
  <a class="topnav__cta" href="${SITE.url('index.html#contact')}">Enquire</a>
</header>`;
});
