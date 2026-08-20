/* -------------------------------------------------------------------------
   Ehsan Towers — load-in gate + frame-sequence scrub

   The load-in animation itself lives entirely in style.css. This file's only
   job in that respect is to flip ONE flag — `is-ready` on <html> — once the
   hero footage has actually decoded. Both the content ripple and the
   background-media entrance hang off that single flag, so the copy and the
   footage arrive together instead of racing.
   ------------------------------------------------------------------------- */

const ROOT = document.documentElement;

const FRAME_DIR   = 'frames-hd';   // cut by tools/cut-frames.sh from the source mp4
const FRAME_EXT   = '.webp';
const FRAME_FIRST = 1;
const FRAME_LAST  = 30;   // frames 31..140 exist on disk but are not loaded
const FRAME_COUNT = FRAME_LAST - FRAME_FIRST + 1;

const src = (n) => `${FRAME_DIR}/${String(n).padStart(5, '0')}${FRAME_EXT}`;


/* ---------- persistent chrome: ripple once per session ----------
   CURRENTLY DORMANT: the nav bar was removed, so nothing on the page carries
   [data-chrome] and this flag has no elements to act on. Kept because it is a
   spec requirement and is exactly what any re-added persistent chrome needs —
   tag the element [data-chrome] and it plays once per session, then jumps
   straight to the settled state. Applied before `is-ready` so such an element
   never starts an animation it is about to skip. */

const CHROME_KEY = 'ehsan:chrome-rippled';

try {
  if (sessionStorage.getItem(CHROME_KEY)) {
    ROOT.classList.add('chrome-settled');
  } else {
    sessionStorage.setItem(CHROME_KEY, '1');
  }
} catch {
  /* private mode / storage disabled — play it, which is the safe default. */
}


/* ---------- scroll scrub ---------- */

const canvas = document.getElementById('sequence');
const ctx    = canvas.getContext('2d', { alpha: false });
const stage  = document.querySelector('.stage');
const fixed  = document.querySelector('.stage__fixed');

let wanted   = 0;   // frame index the scroll position asks for
let painted  = -1;  // frame index currently on the canvas

ctx.imageSmoothingQuality = 'high';

/* The backing store follows the SOURCE frames rather than a hardcoded size —
   otherwise higher-resolution frames get resampled down into a 720p buffer on
   the way in and the extra detail is thrown away before CSS ever scales it up.
   The markup's width/height are only a placeholder aspect for the first paint. */
function sizeCanvasTo(img) {
  if (canvas.width === img.naturalWidth && canvas.height === img.naturalHeight) return;
  canvas.width  = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.imageSmoothingQuality = 'high';  // resizing resets context state
  painted = -1;                        // ...and clears the backing store
}

function draw(i) {
  const img = frames[i];
  if (!img || painted === i) return;
  sizeCanvasTo(img);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  painted = i;
}

/** Nearest already-loaded frame, so scrubbing stays responsive mid-download. */
function nearestLoaded(i) {
  if (frames[i]) return i;
  for (let d = 1; d < FRAME_COUNT; d++) {
    if (frames[i - d]) return i - d;
    if (frames[i + d]) return i + d;
  }
  return -1;
}

/* ---------- the gate ----------
   Frame 1 only. Waiting on the whole sequence would hold the reveal until every
   frame landed; the rest stream in behind the entrance instead. */

const frames = new Array(FRAME_COUNT);
let readyFired = false;

function markReady() {
  if (readyFired) return;
  readyFired = true;
  ROOT.classList.add('is-ready');   // the one flag both effects listen for
}

function loadFrame(i) {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload  = () => { frames[i] = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = src(FRAME_FIRST + i);
  });
}

loadFrame(0).then((img) => {
  if (img) draw(0);
  markReady();
  streamRest();
});

// Never strand the page behind a stalled network.
setTimeout(markReady, 4000);


/* ---------- stream the remaining frames ---------- */

const CONCURRENCY = 6;

function streamRest() {
  let next = 1;
  const worker = async () => {
    while (next < FRAME_COUNT) {
      const i = next++;
      await loadFrame(i);
      if (i === wanted) draw(i);   // the frame we're parked on just arrived
    }
  };
  for (let w = 0; w < CONCURRENCY; w++) worker();
}


/* Hand-off: the hero copy is position:fixed, so without this it would sit
   behind the content sections forever. Fading it out over the TAIL of the scrub
   means the hero has cleared by the time the first section arrives, instead of
   the section slamming over live copy. Deliberately applied to the whole block
   — this is an exit, and an exit reads correctly as one gesture. */
const HANDOFF_START = 0.55;

function heroHandoff(p) {
  const out = Math.min(Math.max((p - HANDOFF_START) / (1 - HANDOFF_START), 0), 1);
  fixed.style.opacity = String(1 - out);
  // Stop the faded copy from swallowing clicks meant for the content below.
  fixed.style.visibility = out === 1 ? 'hidden' : '';
}

function onScroll() {
  const travel = stage.offsetHeight - window.innerHeight;
  const p = travel > 0
    ? Math.min(Math.max(-stage.getBoundingClientRect().top / travel, 0), 1)
    : 0;

  wanted = Math.round(p * (FRAME_COUNT - 1));

  const i = nearestLoaded(wanted);
  if (i >= 0) draw(i);

  heroHandoff(p);
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
