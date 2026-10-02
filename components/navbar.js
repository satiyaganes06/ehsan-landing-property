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
    { label: 'About',       href: 'html/about.html', match: ['about.html'] },
    { label: 'Work record', href: 'html/projects.html',  match: ['projects.html', 'project-detail.html'] },
    { label: 'Gallery',     href: 'index.html#gallery', match: [] },
    { label: 'Events',      href: 'index.html#events',  match: [] },
    { label: 'Contact',     href: 'index.html#contact', match: [] },
    { label: 'News',        href: 'html/news.html', match: ['news.html', 'news-detail.html'] },
  ];

  const links = LINKS.map(({ label, href, match }) => {
    const current = match.includes(SITE.page) ? ' class="is-current"' : '';
    return `<a href="${SITE.url(href)}"${current}>${label}</a>`;
  }).join('\n    ');
  const projectPage = SITE.page === 'project-detail.html' || SITE.page === 'project.html';

  return `
<header class="topnav" id="topnav">
  <a class="topnav__brand" href="${SITE.url('index.html')}">
    <img src="${SITE.url('assets/logo/epp_logo.png')}" alt="Ehsan Plant &amp; Property logo" width="32" height="32" decoding="async">
    <span class="topnav__brand-full">Ehsan Plant &amp; Property</span>
  </a>
  <nav class="topnav__links${projectPage ? ' topnav__links--replaced' : ''}" aria-label="Primary">
    ${links}
  </nav>
  <a class="topnav__cta" href="${SITE.url('index.html#contact')}">Enquire</a>
  ${projectPage ? `<details class="project-nav"><summary aria-label="Main menu"><svg class="project-nav__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path class="project-nav__line project-nav__line--top" d="M4 7h16"/><path class="project-nav__line project-nav__line--middle" d="M4 12h16"/><path class="project-nav__line project-nav__line--bottom" d="M4 17h16"/></svg></summary><nav aria-label="Main menu">${links}</nav></details>` : ''}
</header>`;
});
