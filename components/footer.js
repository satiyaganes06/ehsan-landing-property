/* -------------------------------------------------------------------------
   components/footer.js — the site-wide footer.

   Previously this markup lived only in index.html; as a component it now sits
   at the foot of every page. The three link columns are data, not markup, so
   adding a property or a social account is a one-line change.
   ------------------------------------------------------------------------- */

SITE.define('footer', (SITE) => {
  const COLUMNS = [
    {
      heading: 'Company',
      links: [
        { label: 'Home',        href: 'index.html' },
        { label: 'About Us',    href: 'html/about.html' },
        { label: 'Work Record', href: 'index.html#record' },
        { label: 'Recognition', href: 'index.html#awards' },
      ],
    },
    {
      heading: 'Properties',
      links: [
        { label: 'Taman Mawar Ehsan',        href: 'index.html#record' },
        { label: 'Taman Universiti Bestari', href: 'index.html#record' },
        { label: 'Residensi Mutiara Austin', href: 'index.html#record' },
        { label: 'Ehsan Widuri Putra Nilai', href: 'index.html#record' },
      ],
    },
    {
      heading: 'Contact',
      links: [
        { label: '03-2162 6649',            href: 'tel:+60321626649',            external: true },
        { label: 'info@ehsanproperty.com',  href: 'mailto:info@ehsanproperty.com', external: true },
        { label: 'ehsanproperty.com',       href: 'https://ehsanproperty.com',   external: true, blank: true },
      ],
    },
    {
      heading: 'Social',
      links: [
        { label: 'Facebook',  href: '#', blank: true },
        { label: 'Instagram', href: '#', blank: true },
        { label: 'LinkedIn',  href: '#', blank: true },
      ],
    },
  ];

  const columns = COLUMNS.map((col) => {
    const items = col.links.map(({ label, href, external, blank }) => {
      // Only project-root-relative paths get rewritten; tel:, mailto: and
      // absolute URLs are already resolvable from anywhere.
      const url = external || href.startsWith('#') ? href : SITE.url(href);
      const target = blank ? ' target="_blank" rel="noopener"' : '';
      return `<li><a href="${url}"${target}>${label}</a></li>`;
    }).join('\n          ');

    return `
      <div class="site-footer__column">
        <h4 class="site-footer__heading">${col.heading}</h4>
        <ul class="site-footer__links">
          ${items}
        </ul>
      </div>`;
  }).join('\n');

  return `
<footer class="site-footer">
  <div class="site-footer__container">
    <div class="site-footer__top">${columns}
    </div>

    <div class="site-footer__divider"></div>

    <div class="site-footer__bottom">
      <div class="site-footer__copyright">
        <p>&copy; ${new Date().getFullYear()} Ehsan Plant &amp; Property Sdn Bhd (817795-X)</p>
        <p>CIDB G7 Bumiputera Contractor</p>
      </div>

      <div class="site-footer__legal">
        <a href="#" class="site-footer__legal-link">Privacy Policy</a>
        <span class="site-footer__separator"></span>
        <a href="#" class="site-footer__legal-link">Terms of Service</a>
        <span class="site-footer__separator"></span>
        <a href="#" class="site-footer__legal-link">Disclaimer</a>
      </div>
    </div>
  </div>
</footer>`;
});
