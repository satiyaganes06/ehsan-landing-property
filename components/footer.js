SITE.define('footer', SITE => {
  const year = () => new Intl.DateTimeFormat('en', {year:'numeric',timeZone:'Asia/Kuala_Lumpur'}).format(new Date());
  if (!window.ehsanFooterYearTimer) {
    const refreshYear = () => { document.querySelectorAll('[data-footer-year]').forEach(node => { node.textContent = year(); }); };
    window.ehsanFooterYearTimer = setInterval(refreshYear, 60_000);
    document.addEventListener('visibilitychange', refreshYear);
  }
  if (!document.getElementById('ehsan-footer-style')) {
    const style = document.createElement('link');
    style.id = 'ehsan-footer-style'; style.rel = 'stylesheet';
    style.href = SITE.url('css/footer.css?v=20261002.51'); document.head.append(style);
  }
  return `<footer class="site-footer footer-landscape">
    <div class="footer-landscape__inner">
      <div class="footer-landscape__top">
        <a class="footer-landscape__brand" href="${SITE.url('/')}" aria-label="Ehsan Plant & Property home">
          <img src="${SITE.url('assets/logo/epp_logo.png')}" alt="Ehsan Plant & Property logo" width="116" height="116">
          <span>We build<br>for your<br>needs</span>
        </a>
        <div class="footer-landscape__contact">
          <h2>Get in touch</h2>
          <p class="footer-landscape__company">Ehsan Plant &amp; Property Sdn Bhd</p>
          <address>Suite C-20-3A, Level 20, Block C, Megan Avenue II,<br>Jalan Yap Kwan Seng, 50450 Kuala Lumpur.</address>
          <a href="tel:+60321626649">Tel: 03-2162 6649</a>
          <a href="mailto:info@ehsanproperty.com">Email: info@ehsanproperty.com</a>
        </div>
      </div>
      <div class="footer-landscape__bottom">
        <p>&copy; <span data-footer-year>${year()}</span> Ehsan Plant &amp; Property Sdn Bhd. All rights reserved.</p>
        <nav aria-label="Footer"><a href="${SITE.url('about')}">About</a><a href="${SITE.url('projects')}">Projects</a><a href="${SITE.url('project-licensing/')}">Project Licensing</a><a href="https://www.instagram.com/ehsan_property/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="https://www.tiktok.com/@ehsanproperties" target="_blank" rel="noopener noreferrer">TikTok ↗</a></nav>
      </div>
    </div>
  </footer>`;
});
