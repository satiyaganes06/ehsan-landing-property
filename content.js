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

   Every one of these degrades to the authored HTML if it never runs: the
   marquees show one static column, the numbers already read correctly in the
   markup, the ledger is a plain table, the rail simply stays inert.
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
})();
