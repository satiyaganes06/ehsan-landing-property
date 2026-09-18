/* Where published content comes from.

   Unset, the site reads the checked-in data/*.json exactly as before, so
   nothing changes until you decide to switch. Point it at the deployed panel
   to serve content straight from the CMS:

     <script>window.EHSAN_CMS_ORIGIN = 'https://admin.ehsanproperty.com';</script>

   Set it before this script loads (a <script> tag in the page head does it).
*/
function cmsUrl(file, fallback) {
  const origin = window.EHSAN_CMS_ORIGIN;
  return origin ? origin.replace(/\/$/, '') + '/api/public/' + file : SITE.url(fallback);
}

/* =========================================================================
   events.js — the full event listing.

   Reads events.json, the same file event-detail.js reads, so the list and the
   detail pages can never drift apart. Cards reuse the .event-card markup and
   styling from content.css that the home page strip already uses.
   ========================================================================= */

(function () {
  'use strict';

  const ROOT   = document.documentElement;
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)');

  const listEl   = document.getElementById('eventsList');
  const filterEl = document.getElementById('eventsFilter');
  const countEl  = document.getElementById('eventsCount');
  const emptyEl  = document.getElementById('eventsEmpty');

  let events = [];      // [id, data] pairs, in file order
  let active = 'All';

  /* ---------- render ---------- */

  const card = ([id, ev], i) => `
    <a href="event-detail.html?event=${encodeURIComponent(id)}" class="event-card" style="--i:${i}">
      <div class="event-image-wrapper">
        <img src="${ev.image}" alt="${ev.title}" loading="lazy" decoding="async" referrerpolicy="no-referrer">
        <span class="event-category">${ev.category}</span>
      </div>
      <div class="event-body">
        <h2 class="event-title">${ev.title}</h2>
        <div class="event-meta">
          <div class="event-speaker">
            <img src="${ev.speakers?.[0]?.image || ''}" alt="" referrerpolicy="no-referrer">
            <div>
              <div class="event-speaker-label">Hosted by</div>
              <div class="event-speaker-name">Ehsan Team</div>
            </div>
          </div>
          <div class="event-date">
            <div class="event-date-label">Date</div>
            <div class="event-date-value">${ev.date}</div>
          </div>
        </div>
        <div class="event-stats">
          <span>${ev.location}</span>
          <span>${ev.attendees}</span>
          <span>${ev.price}</span>
        </div>
        <span class="event-cta">Learn more</span>
      </div>
    </a>
  `;

  function render() {
    const shown = active === 'All'
      ? events
      : events.filter(([, ev]) => ev.category === active);

    listEl.innerHTML = shown.map(card).join('');
    emptyEl.hidden = shown.length > 0;

    countEl.textContent = shown.length === events.length
      ? `${events.length} event${events.length === 1 ? '' : 's'}`
      : `${shown.length} of ${events.length} events`;

    // Cards are built after load, so the site-wide [data-reveal] observer in
    // app.js would never see them. They animate from CSS instead, staggered by
    // the --i index set above.
    if (!REDUCE.matches) listEl.classList.add('is-animated');
  }

  function renderFilter() {
    const cats = ['All', ...new Set(events.map(([, ev]) => ev.category))];

    filterEl.innerHTML = cats.map((c) => `
      <button type="button" class="events-filter__btn${c === active ? ' is-active' : ''}"
              data-cat="${c}" aria-pressed="${c === active}">${c}</button>
    `).join('');
  }

  filterEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    active = btn.dataset.cat;
    renderFilter();
    render();
  });

  /* ---------- load ---------- */

  fetch(cmsUrl('events.json', 'data/events.json'))
    .then((r) => {
      if (!r.ok) throw new Error(`events.json → ${r.status}`);
      return r.json();
    })
    .then((data) => {
      events = Object.entries(data);
      renderFilter();
      render();
    })
    .catch((err) => {
      console.error('Could not load events:', err);
      emptyEl.hidden = false;
      emptyEl.textContent = 'Events could not be loaded. Please refresh, or email info@ehsanproperty.com.';
    });

  /* ---------- chrome ---------- */

  // Same flag the other subpages set, so the topnav drops into its scrolled
  // state instead of sitting transparent over the page.
  const onScroll = () => ROOT.classList.toggle('past-hero', window.scrollY > 1);
  addEventListener('scroll', onScroll, { passive: true });

  ROOT.classList.add('is-ready');
  onScroll();
})();
