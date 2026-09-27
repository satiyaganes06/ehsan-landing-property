/* -------------------------------------------------------------------------
   Ehsan Plant & Property — arrival and architectural camera motion
   ------------------------------------------------------------------------- */
const ROOT = document.documentElement;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

const CHROME_KEY = 'ehsan:chrome-rippled';
try {
  if (sessionStorage.getItem(CHROME_KEY)) ROOT.classList.add('chrome-settled');
  else sessionStorage.setItem(CHROME_KEY, '1');
} catch { /* Storage is optional. */ }

const scene = document.getElementById('hero-scene');
const stage = document.querySelector('.stage');
let readyFired = false;
function markReady() {
  if (readyFired) return;
  readyFired = true;
  ROOT.classList.add('is-ready');
}
if (scene) {
  scene.decode().catch(() => {}).finally(markReady);
} else {
  markReady();
}
setTimeout(markReady, 4000);

let cameraProgress = 0;
let cameraTarget = 0;
let cameraFrame = 0;
let cameraTime = 0;
const MOBILE_CAMERA = matchMedia('(max-width: 760px)');

function paintCamera() {
  const strength = MOBILE_CAMERA.matches ? .5 : 1;
  const p = cameraProgress;
  stage.style.setProperty('--camera-x', `${(-p * 38 * strength).toFixed(2)}px`);
  stage.style.setProperty('--camera-y', `${(p * 100 * strength).toFixed(2)}px`);
  stage.style.setProperty('--camera-pitch', `${(p * 2 * strength).toFixed(3)}deg`);
  stage.style.setProperty('--camera-bank', `${(Math.sin(p * Math.PI) * .65 * strength).toFixed(3)}deg`);
  stage.style.setProperty('--camera-scale', (1 + p * .18 * strength).toFixed(4));
}

function animateCamera(time) {
  const elapsed = Math.min(time - (cameraTime || time - 16), 64);
  cameraTime = time;
  cameraProgress += (cameraTarget - cameraProgress) * (1 - Math.exp(-elapsed / 140));
  if (Math.abs(cameraTarget - cameraProgress) < .0005) cameraProgress = cameraTarget;
  paintCamera();
  cameraFrame = cameraProgress === cameraTarget ? 0 : requestAnimationFrame(animateCamera);
  if (!cameraFrame) cameraTime = 0;
}

function onScroll() {
  if (!stage || stage.hidden) return;
  const rect = stage.getBoundingClientRect();
  cameraTarget = REDUCED.matches ? 0 : Math.min(Math.max(-rect.top / rect.height, 0), 1);
  if (REDUCED.matches || rect.bottom <= 0 || document.hidden) {
    cancelAnimationFrame(cameraFrame);
    cameraFrame = 0;
    cameraTime = 0;
    cameraProgress = cameraTarget;
    paintCamera();
  } else if (!cameraFrame) {
    cameraFrame = requestAnimationFrame(animateCamera);
  }
}
let queued = false;
window.addEventListener('scroll', () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; onScroll(); });
}, { passive: true });
window.addEventListener('resize', onScroll, { passive: true });
REDUCED.addEventListener('change', onScroll);
document.addEventListener('visibilitychange', onScroll);
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
