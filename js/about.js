/* -------------------------------------------------------------------------
   about.js — load-in gate + section reveal for the stage-free pages.

   app.js can't be reused here: it opens with `document.getElementById(
   'sequence').getContext(...)`, which throws the moment there's no hero
   canvas on the page and halts the rest of that script — including the
   reveal observer at its tail. This is the same two effects app.js drives
   (the `is-ready` gate, the [data-reveal] IntersectionObserver), just
   without the frame-sequence scrub they were built to follow. Every page
   this loads on has no hero to wait for, so `is-ready` fires immediately
   instead of on frame-1 decode.
   ------------------------------------------------------------------------- */

const ROOT = document.documentElement;

ROOT.classList.add('is-ready');

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

function armReveals() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window) || REDUCED.matches) return;

  ROOT.classList.add('reveal-armed');

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-revealed');
      io.unobserve(entry.target);
    }
  }, {
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.1,
  });

  targets.forEach((el) => io.observe(el));
}

armReveals();
