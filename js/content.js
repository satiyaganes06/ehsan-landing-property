/* -------------------------------------------------------------------------
   content.js — behaviour for everything BELOW the hero stage.

   Deliberately a separate file from app.js. app.js owns the stage: the frame
   scrub, the `is-ready` load-in gate and the [data-reveal] IntersectionObserver.
   Nothing here reaches into any of that — this file only adds behaviour that
   the reveal system cannot express on its own:

     1. marquee cloning     the vertical auto-scrollers need a second copy of
                            their content before the -50% loop is seamless
     2. count-up            numbers that tick to their authored value
     3. ledger peek         a cursor-tracked photo panel over the work record
     4. running tally       project value accumulating as rows pass mid-screen
     5. chrome              scroll progress bar + section rail current-state
     6. story cards         one testimonial card expanded at a time, on hover
     7. ledger disclosure   "view more" reveals the rest of the work record
     8. assistant widget    the floating chat launcher, canned replies only
     9. row navigation      work-record rows open their detail page
    10. awards carousel     auto-scrolling recognition strip
    11. enquiry form        client-side validation, placeholder submit
    12. commitment stage    scattered grid scrubbed through a pinned panel

   Every one of these degrades to the authored HTML if it never runs: the
   marquees show one static column, the numbers already read correctly in the
   markup, the ledger is a plain table, the rail simply stays inert, and the
   commitment stage stays a plain grid above a numbered list. The topnav needs
   nothing here at all — it hangs off the same html.past-hero flag #5 already
   sets.
   ------------------------------------------------------------------------- */

(() => {
  const ROOT   = document.documentElement;
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- 1. marquee cloning ----------
     Each track holds ONE .vscroll__half in the markup; the loop needs two
     identical halves so the keyframe's -50% lands on the seam. Cloning in JS
     rather than duplicating in HTML keeps the source readable and keeps the
     content in exactly one place. aria-hidden on the copy so screen readers
     read each item once. */

  document.querySelectorAll('[data-clone]').forEach((track) => {
    const half = track.firstElementChild;
    if (!half) return;
    const copy = half.cloneNode(true);
    copy.setAttribute('aria-hidden', 'true');
    track.appendChild(copy);
  });


  /* ---------- 2. count-up ----------
     Authored value stays in the HTML and is only replaced once the element is
     actually in view, so there is no flash of "0" and no-JS reads correctly.
     Formatting is re-derived from the target rather than stored, so the comma
     grouping in "3,442" survives the animation. */

  const counters = document.querySelectorAll('[data-count]');

  function runCount(el) {
    const target = parseFloat(el.dataset.count);
    const dp     = parseInt(el.dataset.dp || '0', 10);
    if (!isFinite(target)) return;

    const fmt = (v) => v.toLocaleString('en-US', {
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    });

    const DURATION = 1400;
    const start = performance.now();

    const step = (now) => {
      const t = Math.min((now - start) / DURATION, 1);
      // Same easing family as the reveal (a strong ease-out) so the numbers
      // settle on the beat the surrounding copy does.
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = fmt(target * eased);
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = fmt(target);
    };

    requestAnimationFrame(step);
  }

  if (counters.length && 'IntersectionObserver' in window && !REDUCE.matches) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        runCount(e.target);
        io.unobserve(e.target);
      }
    }, { threshold: 0.6 });

    counters.forEach((el) => io.observe(el));
  }


  /* ---------- 3. ledger peek ----------
     Lifts the row's own <img> into a fixed panel that follows the pointer. The
     same <img> is what mobile shows inline (see .row__shot in content.css), so
     there is only ever one copy of each photo in the document.

     Fine pointers only. On touch the panel would have nothing to track, and the
     inline thumbnails already do the job. */

  const peek = document.querySelector('.peek');
  const rows = document.querySelectorAll('.row');

  if (peek && rows.length && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const peekImg = peek.querySelector('img');
    const peekCap = peek.querySelector('.peek__cap');

    let x = 0, y = 0, queued = false;

    // Position only. The panel is clamped to the viewport on both axes so it
    // never hangs off an edge, and the write is transform-only so it stays on
    // the compositor.
    const place = () => {
      queued = false;
      const w = peek.offsetWidth  || 336;
      const h = peek.offsetHeight || 252;
      const cx = Math.min(Math.max(x, w / 2 + 16), window.innerWidth  - w / 2 - 16);
      const cy = Math.min(Math.max(y, h / 2 + 16), window.innerHeight - h / 2 - 16);
      peek.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
    };

    rows.forEach((row) => {
      const src = row.querySelector('img');
      const name = row.querySelector('.row__name');
      if (!src || !name) return;

      row.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        peekImg.src = src.currentSrc || src.src;
        peekImg.alt = '';
        peekCap.textContent = name.textContent;
        x = e.clientX + 180;   // offset right of the cursor, clear of the copy
        y = e.clientY;
        place();               // place BEFORE showing, so it never fades in mid-flight
        peek.classList.add('is-on');
      });

      row.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        x = e.clientX + 180;
        y = e.clientY;
        if (queued) return;
        queued = true;
        requestAnimationFrame(place);
      });

      row.addEventListener('pointerleave', () => {
        peek.classList.remove('is-on');
      });
    });
  }


  /* ---------- 4. running tally ----------
     Sums data-val (RM millions) for every row whose top has crossed 65% of the
     viewport, so the figure climbs as the ledger is read rather than jumping to
     a total the moment the section appears. */

  const tallyEl = document.querySelector('[data-tally]');

  if (tallyEl && rows.length) {
    const vals = [...rows].map((r) => parseFloat(r.dataset.val) || 0);
    let shown = -1;

    const paint = () => {
      const line = window.innerHeight * 0.65;
      let sum = 0;
      rows.forEach((r, i) => {
        if (r.getBoundingClientRect().top < line) sum += vals[i];
      });
      if (sum === shown) return;
      shown = sum;
      tallyEl.textContent = sum >= 1000
        ? `RM ${(sum / 1000).toFixed(3)} bil`
        : `RM ${sum.toLocaleString('en-US', { maximumFractionDigits: 1 })} mil`;
    };

    let tQueued = false;
    addEventListener('scroll', () => {
      if (tQueued) return;
      tQueued = true;
      requestAnimationFrame(() => { tQueued = false; paint(); });
    }, { passive: true });
    paint();
  }


  /* ---------- 5. chrome ----------
     The progress bar and rail are hidden until <html> carries `past-hero`, so
     neither ever overlays the stage while the stage is still the thing on
     screen. The flag is driven by the content block's own top edge rather than
     a pixel threshold, so it stays correct at any viewport height. */

  const content = document.getElementById('content');
  const bar     = document.querySelector('.progress__bar');
  const links   = [...document.querySelectorAll('.rail a')];
  const targets = links
    .map((a) => document.getElementById(a.getAttribute('href').slice(1)))
    .filter(Boolean);

  let cQueued = false;

  function chrome() {
    cQueued = false;

    if (content) {
      ROOT.classList.toggle('past-hero', content.getBoundingClientRect().top <= 1);
    }

    if (bar) {
      const travel = document.documentElement.scrollHeight - window.innerHeight;
      const p = travel > 0 ? Math.min(Math.max(window.scrollY / travel, 0), 1) : 0;
      bar.style.transform = `scaleX(${p})`;
    }

    // Current section: the last one whose top has passed a third of the screen.
    if (targets.length) {
      const line = window.innerHeight / 3;
      let current = -1;
      targets.forEach((t, i) => {
        if (t.getBoundingClientRect().top <= line) current = i;
      });
      links.forEach((a, i) => a.classList.toggle('is-current', i === current));
    }
  }

  addEventListener('scroll', () => {
    if (cQueued) return;
    cQueued = true;
    requestAnimationFrame(chrome);
  }, { passive: true });

  addEventListener('resize', chrome, { passive: true });
  chrome();


  /* ---------- 6. story cards ----------
     One [data-story] carries .is-active in the markup by default (the first
     one), so the section is already correct before this runs. Hover/focus
     just moves that class — the width, background and reveal transitions all
     live in content.css keyed off [is-active], nothing is animated from JS.
     aria-hidden on .story__body follows the same class so the collapsed
     cards' quotes are hidden from assistive tech, not just visually shrunk. */

  const stories = document.querySelectorAll('[data-story]');

  if (stories.length) {
    // The collapse-to-a-tile layout only exists >=1024px (content.css); below
    // that every card's body is shown at full size regardless of [is-active].
    // aria-hidden has to track the SAME breakpoint, or a resize down to mobile
    // would leave three visible quotes hidden from assistive tech.
    const collapses = matchMedia('(min-width: 1024px)');

    const activate = (target) => {
      stories.forEach((s) => {
        const active = s === target;
        s.classList.toggle('is-active', active);
        const body = s.querySelector('.story__body');
        if (body) body.setAttribute('aria-hidden', String(!active && collapses.matches));
      });
    };

    const current = () => document.querySelector('[data-story].is-active') || stories[0];

    stories.forEach((s) => {
      s.addEventListener('mouseenter', () => activate(s));
      s.addEventListener('focus', () => activate(s));
    });

    collapses.addEventListener('change', () => activate(current()));
  }


  /* ---------- smooth anchor scrolling for the rail ---------- */

  links.forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({
        behavior: REDUCE.matches ? 'auto' : 'smooth',
        block: 'start',
      });
      history.replaceState(null, '', `#${id}`);
    });
  });


  /* ---------- 7. ledger disclosure ----------
     The work record ships with only the first five rows visible; the rest
     sit behind [hidden] in .ledger__more so the page never promises "sixteen
     projects" and shows five. Un-hiding rather than un-rendering means the
     IntersectionObserver from #armReveals (app.js) is already watching every
     row — newly shown rows still play the same reveal-in the visible ones did. */

  const moreBtn = document.getElementById('ledgerMoreBtn');
  const more    = document.getElementById('ledgerMore');

  if (moreBtn && more) {
    const LABEL_MORE = moreBtn.querySelector('span').textContent;
    const LABEL_LESS = 'Show fewer projects';

    moreBtn.addEventListener('click', () => {
      const open = more.hasAttribute('hidden');
      more.toggleAttribute('hidden', !open);
      moreBtn.setAttribute('aria-expanded', String(open));
      moreBtn.querySelector('span').textContent = open ? LABEL_LESS : LABEL_MORE;
      if (!open) {
        moreBtn.scrollIntoView({ behavior: REDUCE.matches ? 'auto' : 'smooth', block: 'nearest' });
      }
    });
  }


  /* ---------- 8. assistant widget ----------
     A placeholder, and labelled as one in the panel itself — there is no
     model behind this, just a small set of canned replies keyed on keywords
     the profile actually covers, so the demo never implies more than it is. */

  const assistant = document.querySelector('[data-assistant]');

  if (assistant) {
    const toggle = assistant.querySelector('[data-assistant-toggle]');
    const panel  = assistant.querySelector('.assistant__panel');
    const log    = assistant.querySelector('[data-assistant-log]');
    const form   = assistant.querySelector('[data-assistant-form]');
    const input  = assistant.querySelector('[data-assistant-input]');

    const setOpen = (open) => {
      assistant.toggleAttribute('data-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      panel.toggleAttribute('hidden', !open);
      if (open) input.focus();
    };

    toggle.addEventListener('click', () => setOpen(!assistant.hasAttribute('data-open')));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && assistant.hasAttribute('data-open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    const say = (text, who) => {
      const p = document.createElement('p');
      p.className = `assistant__msg assistant__msg--${who}`;
      p.textContent = text;
      log.appendChild(p);
      log.scrollTop = log.scrollHeight;
    };

    const REPLIES = [
      { hit: /project|unit|launch|widuri|austin|bestari/i,
        say: "Our current work is on the Work record section — Ehsan Widuri, Residensi Mutiara Austin and Taman Universiti Bestari are all under construction now." },
      { hit: /price|cost|much|rm\s?\d/i,
        say: "Pricing varies by project and phase — the fastest answer is a call to 03-2162 6649 or info@ehsanproperty.com." },
      { hit: /contact|call|email|phone|reach/i,
        say: "You can reach the team at 03-2162 6649 or info@ehsanproperty.com — details are also in the Contact section below." },
      { hit: /award|accredit|cidb|certif/i,
        say: "Ehsan is a CIDB G7 Bumiputera contractor with ISO, SIRIM and SSM certification, plus twelve national and regional awards since 2014." },
    ];
    const FALLBACK = "Thanks for the message — I'm just a placeholder for now, so I can't answer that yet. Our team will follow up if you leave your details at info@ehsanproperty.com.";

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      say(text, 'user');
      input.value = '';

      const match = REPLIES.find((r) => r.hit.test(text));
      window.setTimeout(() => say(match ? match.say : FALLBACK, 'bot'), 450);
    });
  }

  /* ---------- 9. project row navigation ----------
     Navigate to project detail page on row click.

     Through SITE.url, not a bare relative path. The detail page lives in
     /html/ while the ledger that links to it is at the root, so a plain
     "project-detail.html" resolved to /project-detail.html and 404'd. A plain
     "html/project-detail.html" would fix the root case and break everywhere
     else — this file is loaded by all five pages, four of which are already
     inside /html/ and would resolve it to /html/html/. SITE.url anchors the
     path to the project root regardless of which page is asking. */

  document.querySelectorAll('.row[data-project-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const projectId = row.dataset.projectId;
      if (projectId) {
        window.location.href =
          SITE.url(`html/project-detail.html?project=${encodeURIComponent(projectId)}`);
      }
    });
  });

  /* ---------- 10. awards carousel (Kelo-inspired) ----------
     Horizontal auto-scroll via requestAnimationFrame, pause on hover, modal details */

  const AWARD_DATA = {
    'award-1': { year: '2014', title: 'Selangor Excellence Business Awards', description: 'Recognized for excellence in business practices and significant contribution to the Selangor business community.' },
    'award-2': { year: '2015', title: 'ASEAN Outstanding Business Awards', description: 'Acknowledged for outstanding business practices and regional contribution across the ASEAN region.' },
    'award-3': { year: '2016', title: 'MIMCOIN SME Congress & Golden Dinar Awards', description: 'Honored for SME development initiatives and innovative business practices.' },
    'award-4': { year: '2019', title: 'MIMCOIN SME Congress & Golden Dinar Awards', description: 'Continued recognition for exceptional SME contributions and sustained business growth.' },
    'award-5': { year: '2014', title: 'Global Leadership Awards', description: 'Recognized for outstanding leadership and vision in the property development industry.' },
    'award-6': { year: '2015', title: 'SME Recognition Awards', description: 'Acknowledged for significant contributions to SME sector growth and industry development.' },
    'award-7': { year: '2017', title: 'MIMCOIN SME Congress & Golden Dinar Awards', description: 'Honored for sustained excellence in SME innovation and business development.' },
    'award-8': { year: '2022', title: 'Bumiputera Business Excellence Awards', description: 'Recognized for excellence in Bumiputera business practices and community development.' },
    'award-9': { year: '2017', title: 'Malaysia Top Achiever Awards', description: 'Acknowledged as a top achiever in property development and business excellence.' },
    'award-10': { year: '2018', title: 'Global Leadership Awards', description: 'Honored for global leadership, innovation, and strategic business practices.' },
    'award-11': { year: '2023', title: 'Nambikhai Business Icon Awards', description: 'Recognized as a business icon for excellence, innovation, and lasting industry impact.' },
    'award-12': { year: '2023', title: 'Consumer\'s Choice Award', description: 'Awarded by consumers for outstanding service quality and customer satisfaction.' }
  };

  // Auto-scroll carousel (Kelo pattern: requestAnimationFrame + pause on hover)
  const awardTrack = document.getElementById('awardTrack');
  if (awardTrack) {
    const cards = Array.from(awardTrack.querySelectorAll('.award-card'));
    let scrollPos = { current: 0 };
    let isHovered = false;
    let animationFrameId = null;

    // Duplicate cards for seamless loop
    cards.forEach((card) => {
      const clone = card.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      awardTrack.appendChild(clone);
    });

    // Auto-scroll loop
    function autoScroll() {
      if (!isHovered) {
        scrollPos.current += 0.5;
        // Reset to 0 when we've scrolled halfway (seamless loop)
        if (scrollPos.current >= awardTrack.scrollWidth / 2) {
          scrollPos.current = 0;
        }
        awardTrack.scrollLeft = scrollPos.current;
      }
      animationFrameId = requestAnimationFrame(autoScroll);
    }

    // Pause on hover
    awardTrack.addEventListener('mouseenter', () => {
      isHovered = true;
      scrollPos.current = awardTrack.scrollLeft;
    });

    awardTrack.addEventListener('mouseleave', () => {
      isHovered = false;
    });

    // Start auto-scroll
    autoScroll();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      cancelAnimationFrame(animationFrameId);
    });
  }

  // Award card click → modal
  const modal = document.getElementById('awardModal');
  const modalBackdrop = document.getElementById('awardModalBackdrop');
  const modalClose = document.getElementById('awardModalClose');

  if (awardTrack) {
    awardTrack.addEventListener('click', (e) => {
      const card = e.target.closest('.award-card');
      if (!card) return;

      const awardId = card.dataset.awardId;
      const award = AWARD_DATA[awardId];
      if (!award) return;

      const icon = card.querySelector('.award-card__icon').textContent;
      document.getElementById('awardModalIcon').textContent = icon;
      document.getElementById('awardModalYear').textContent = award.year;
      document.getElementById('awardModalTitle').textContent = award.title;
      document.getElementById('awardModalDesc').textContent = award.description;

      modal.setAttribute('aria-hidden', 'false');
    });
  }

  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
  }

  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
      closeModal();
    }
  });

  /* ---------- 11. enquiry form ----------
     No backend yet, so this validates client-side and reports the outcome in
     place. `is-validated` gates the :invalid styling so the form is not red on
     first paint — it only turns red once someone has actually tried to send. */

  const enquiry = document.querySelector('[data-enquiry-form]');

  if (enquiry) {
    const status = enquiry.querySelector('[data-enquiry-status]');

    const report = (msg, kind) => {
      if (!status) return;
      status.textContent = msg;
      status.classList.toggle('is-ok', kind === 'ok');
      status.classList.toggle('is-err', kind === 'err');
    };

    enquiry.addEventListener('submit', (e) => {
      e.preventDefault();
      enquiry.classList.add('is-validated');

      if (!enquiry.checkValidity()) {
        report('Please complete the required fields.', 'err');
        const first = enquiry.querySelector(':invalid');
        if (first) first.focus();
        return;
      }

      report('Thanks — this is a placeholder form, so nothing was sent. Email info@ehsanproperty.com to reach us.', 'ok');
      enquiry.reset();
      enquiry.classList.remove('is-validated');
    });

    // Clear a stale message as soon as the visitor starts editing again.
    enquiry.addEventListener('input', () => {
      if (status && status.textContent) report('', null);
    });
  }


  /* ---------- 12. commitment stage ----------
     The pinned black panel in section 02. Two jobs:

       a. SCATTER. Every cell is given an explicit grid-row/grid-column, so
          the ten photographs walk diagonally across the columns (a second one
          joining every third row) and the five commitments drop into the far
          side of the rows that carry only one card. Explicit placement is
          what lets the markup keep the <ol> intact while the visual order
          zig-zags — grid position is independent of DOM order.

       b. BLOOM. The wrap is translated up through the sticky stage, and each
          cell is scaled from its own position on screen: up as it enters, back
          down as it leaves. Cards scale; text fades and rises instead, because
          type scaled from zero reads as a cheap trick rather than as depth.

     The per-frame pass reads ONE rect (the section's) and then only writes —
     each cell's offset within the stage is cached at measure time, so the
     loop never interleaves reads and writes no matter how many cells there
     are. Everything is gated behind .is-live, which is added here: with this
     module absent the CSS leaves the stage static and the grid auto-flows. */

  const commit = document.getElementById('commitment');
  const cGrid  = commit && commit.querySelector('[data-commit-grid]');

  if (commit && cGrid && !REDUCE.matches) {
    const stage = commit.querySelector('.commit__stage');
    const wrap  = commit.querySelector('.commit__wrap');
    const cue   = commit.querySelector('[data-commit-cue]');
    const cells = [...cGrid.querySelectorAll('.commit__cell')];
    const shots = cells.filter((c) => c.classList.contains('commit__shot'));
    const vows  = cells.filter((c) => c.classList.contains('commit__vow'));

    const put = (el, row, col, cols) => {
      el.style.gridRow    = row + 1;
      el.style.gridColumn = col + 1;
      // Cells bloom toward the middle: the origin is pinned to whichever edge
      // faces the centre of the grid, so the scatter closes inward.
      el.style.transformOrigin = col < cols / 2 ? 'right bottom' : 'left bottom';
    };

    const scatter = (cols) => {
      let s = 0, v = 0;
      for (let r = 0; (s < shots.length || v < vows.length) && r < 60; r++) {
        const taken = new Array(cols).fill(false);
        const a = (r * 2 + (r % 2)) % cols;

        if (s < shots.length) { put(shots[s++], r, a, cols); taken[a] = true; }

        if (r % 3 === 0 && s < shots.length) {
          let b = (a + 2) % cols;
          if (b === a) b = (a + 1) % cols;
          if (!taken[b]) { put(shots[s++], r, b, cols); taken[b] = true; }
        }

        // A commitment takes the far side of the row from the photograph. It
        // lands on odd rows while shots remain, then on any row once they run
        // out. Tightening that to "single-card rows only" was tried and is
        // worse: it pushes the last three commitments past the final
        // photograph and the section trails off into a wall of text.
        if (v < vows.length && (r % 2 === 1 || s >= shots.length)) {
          const want = (a + Math.floor(cols / 2)) % cols;
          let pick = -1, best = Infinity;
          for (let i = 0; i < cols; i++) {
            if (taken[i]) continue;
            const d = Math.abs(i - want);
            if (d < best) { best = d; pick = i; }
          }
          if (pick >= 0) { put(vows[v++], r, pick, cols); taken[pick] = true; }
        }
      }
    };

    let travel = 1;
    let geo    = [];
    let idle   = false;
    let qd     = false;

    function paint() {
      qd = false;
      const vh  = window.innerHeight;
      // Distance scrolled INTO the section. One rect read, taken fresh rather
      // than cached, so nothing above this section resizing can desync it.
      const rel = -commit.getBoundingClientRect().top;

      // Nothing to do while the section is a full viewport away — but flush
      // once on the way out so no cell is left frozen mid-scale.
      if (rel < -vh || rel > travel + vh) {
        if (idle) return;
        idle = true;
      } else {
        idle = false;
      }

      const held = Math.max(0, Math.min(rel, travel));
      const top0 = held - rel;   // stage's own top in the viewport: 0 while pinned

      wrap.style.transform = `translate3d(0, ${-held}px, 0)`;

      // Cue: up as soon as the stage pins, down again before the travel is
      // spent, so it is never pointing at a section that has nothing left.
      if (cue) {
        const p = held / travel;
        const o = Math.max(0, Math.min(1, Math.min(p / 0.05, (0.92 - p) / 0.1)));
        cue.style.opacity = o.toFixed(3);
      }

      for (const g of geo) {
        const top    = top0 + g.top - held;
        const bottom = top + g.h;

        let k = 0;
        if (bottom > 0 && top < vh) {
          const enter = Math.min(1, (vh - top) / (vh * 0.6));
          const exit  = Math.min(1, bottom / (vh * 0.4));
          k = Math.max(0, Math.min(enter, exit));
        }

        if (g.vow) {
          g.el.style.opacity   = k.toFixed(3);
          g.el.style.transform = `translate3d(0, ${((1 - k) * 40).toFixed(2)}px, 0)`;
        } else {
          g.el.style.transform = `scale(${k.toFixed(4)})`;
        }
      }
    }

    function measure() {
      const cols = parseInt(
        getComputedStyle(cGrid).getPropertyValue('--commit-cols'), 10
      ) || 2;

      commit.classList.remove('is-live');
      commit.style.height = '';
      scatter(cols);

      // Live BEFORE measuring: .is-live is what swaps the wrap's padding for
      // the taller live one, so measuring first would cache the wrong offsets.
      commit.classList.add('is-live');

      // Wind every transform back to rest first. Rects are POST-transform, so
      // a cell still holding scale(0) from the last frame would report a
      // collapsed box and poison its own cached geometry — which is exactly
      // what would happen on any resize after the first.
      wrap.style.transform = 'none';
      for (const el of cells) { el.style.transform = 'none'; el.style.opacity = ''; }

      travel = Math.max(1, wrap.offsetHeight);
      // The stall is the section's height minus the stage's, so the stage is
      // MEASURED rather than assumed to be window.innerHeight: it is sized in
      // svh, which on mobile is the small viewport and does not match
      // innerHeight. Assuming would unpin the stage early by the URL-bar's
      // worth of pixels, right at the end of the scroll.
      commit.style.height = `${stage.offsetHeight + travel}px`;

      // Offsets are taken against the stage's own box rather than via
      // offsetTop. offsetParent is defined by `position`, but the wrap carries
      // will-change/transform, and relying on which of the two a given engine
      // hands back is the kind of thing that works until it doesn't.
      const base = stage.getBoundingClientRect().top;
      geo = cells.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          el,
          top: r.top - base,
          h:   r.height,
          vow: el.classList.contains('commit__vow'),
        };
      });

      idle = false;
      paint();
    }

    addEventListener('scroll', () => {
      if (qd) return;
      qd = true;
      requestAnimationFrame(paint);
    }, { passive: true });

    addEventListener('resize', measure, { passive: true });
    measure();

    // The commitments are set in the serif; until it loads their cells are
    // the wrong height, which would leave every cached offset stale.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  }
})();
