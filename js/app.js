/* -------------------------------------------------------------------------
   Ehsan Plant & Property — load-in gate + frame-sequence scrub
   ------------------------------------------------------------------------- */
const ROOT = document.documentElement;
const FRAME_DIR = 'assets/frames-hd';
const FRAME_EXT = '.webp';
const FRAME_FIRST = 1;
const FRAME_LAST = 20;
const FRAME_COUNT = FRAME_LAST - FRAME_FIRST + 1;
const src = (n) => `${FRAME_DIR}/${String(n).padStart(5, '0')}${FRAME_EXT}`;

const CHROME_KEY = 'ehsan:chrome-rippled';
try {
  if (sessionStorage.getItem(CHROME_KEY)) ROOT.classList.add('chrome-settled');
  else sessionStorage.setItem(CHROME_KEY, '1');
} catch { /* Storage is optional. */ }

const canvas = document.getElementById('sequence');
const ctx = canvas.getContext('2d', { alpha: false });
const stage = document.querySelector('.stage');
let wanted = 0;
let painted = -1;
ctx.imageSmoothingQuality = 'high';

function sizeCanvasTo(img) {
  if (canvas.width === img.naturalWidth && canvas.height === img.naturalHeight) return;
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.imageSmoothingQuality = 'high';
  painted = -1;
}
function draw(i) {
  const img = frames[i];
  if (!img || painted === i) return;
  sizeCanvasTo(img);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  painted = i;
}
function nearestLoaded(i) {
  if (frames[i]) return i;
  for (let d = 1; d < FRAME_COUNT; d++) {
    if (frames[i - d]) return i - d;
    if (frames[i + d]) return i + d;
  }
  return -1;
}
const frames = new Array(FRAME_COUNT);
let readyFired = false;
function markReady() {
  if (readyFired) return;
  readyFired = true;
  ROOT.classList.add('is-ready');
}
function loadFrame(i) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.fetchPriority = i === 0 ? 'high' : 'low';
    img.onload = () => { frames[i] = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = src(FRAME_FIRST + i);
  });
}
loadFrame(0).then((img) => {
  if (img) draw(0);
  markReady();
  streamRest();
});
setTimeout(markReady, 4000);

const CONCURRENCY = Math.min(4, FRAME_COUNT - 1);
function streamRest() {
  let next = 1;
  const worker = async () => {
    while (next < FRAME_COUNT) {
      const i = next++;
      await loadFrame(i);
      if (i === wanted) draw(i);
    }
  };
  for (let w = 0; w < CONCURRENCY; w++) worker();
}
function onScroll() {
  const travel = stage.offsetHeight - window.innerHeight;
  const progress = travel > 0
    ? Math.min(Math.max(-stage.getBoundingClientRect().top / travel, 0), 1)
    : 0;
  wanted = Math.round(progress * (FRAME_COUNT - 1));
  const frame = nearestLoaded(wanted);
  if (frame >= 0) draw(frame);
}
let queued = false;
window.addEventListener('scroll', () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; onScroll(); });
}, { passive: true });
window.addEventListener('resize', onScroll, { passive: true });
onScroll();

/* -------------------------------------------------------------------------
   EFFECT 3: SECTION REVEAL ON SCROLL

   Kept deliberately separate from the two load-in effects. Those fire once off
   the `is-ready` gate; this one fires per element as it enters the viewport,
   because content below the fold would otherwise play its entrance while
   off-screen and be fully settled by the time anyone scrolled to it.

   It reuses the ripple's motion language on purpose — same 24px rise, same
   1000ms, same curve, same 100ms-per-ring beat — so the page reads as one
   system rather than two unrelated animation styles.
   ------------------------------------------------------------------------- */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

function armReveals() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;

  // No IntersectionObserver, or the visitor asked for less motion: leave every
  // element in its authored settled state and never arm the hidden start state.
  if (!('IntersectionObserver' in window) || REDUCED.matches) return;

  ROOT.classList.add('reveal-armed');   // only NOW is opacity:0 applied

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-revealed');
      io.unobserve(entry.target);       // once only — no replay on scroll back
    }
  }, {
    // Trigger a little before the element is fully in view, so the motion is
    // already underway rather than starting after it has landed.
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.1,
  });

  targets.forEach((el) => io.observe(el));
}

armReveals();
