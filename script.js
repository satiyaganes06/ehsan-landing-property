(() => {
  "use strict";

  const FRAME_COUNT = 240;
  const FRAME_PATH = (n) => `frames/${String(n).padStart(5, "0")}.jpg`;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const html = document.documentElement;

  const section   = document.querySelector(".cinematic-section");
  const canvas    = document.getElementById("stageCanvas");
  const ctx       = canvas.getContext("2d");
  const panels    = Array.from(document.querySelectorAll("[data-panel]"));
  const railFill  = document.getElementById("railFill");
  const telemetryFrame = document.getElementById("telemetryFrame");
  const navButtons = Array.from(document.querySelectorAll("[data-nav-target]"));
  const loaderFill = document.getElementById("loaderFill");

  panels.forEach(p => {
    p.__start = parseFloat(p.dataset.start);
    p.__in    = parseFloat(p.dataset.in);
    p.__out   = parseFloat(p.dataset.out);
    p.__end   = parseFloat(p.dataset.end);
  });

  /* ---------------------------------------------------------
     Windowed frame cache — holding all 240 decoded bitmaps at
     once (~1MB+ each as raster) is enough to stall the tab, so
     instead we keep a bounded ring of decoded frames around
     whichever index is currently on screen and stream the rest
     in as the visitor scrolls. Canvas blitting from an already-
     decoded Image avoids re-decode cost on every draw.
  --------------------------------------------------------- */
  const CACHE_RADIUS = 26;      // frames kept resident on each side of current
  const INITIAL_BATCH = 18;     // frames awaited before the loader releases

  const cache = new Map();      // index(0-based) -> loaded Image
  const pending = new Map();    // index -> Image currently loading
  let initialLoaded = 0;
  let initialGateOpen = false;

  function loadFrame(index, onDone) {
    if (cache.has(index) || pending.has(index)) return;
    const img = new Image();
    pending.set(index, img);
    const finish = () => {
      pending.delete(index);
      cache.set(index, img);
      if (onDone) onDone();
    };
    if (typeof img.decode === "function") {
      img.src = FRAME_PATH(index + 1);
      img.decode().then(finish).catch(finish);
    } else {
      img.addEventListener("load", finish, { once: true });
      img.addEventListener("error", finish, { once: true });
      img.src = FRAME_PATH(index + 1);
    }
  }

  function ensureWindow(centerIndex) {
    const lo = Math.max(0, centerIndex - CACHE_RADIUS);
    const hi = Math.min(FRAME_COUNT - 1, centerIndex + CACHE_RADIUS);
    for (let i = lo; i <= hi; i++) loadFrame(i);
    // Evict anything far outside the window to keep memory bounded.
    for (const idx of cache.keys()) {
      if (idx < lo - 6 || idx > hi + 6) cache.delete(idx);
    }
  }

  // Closest resident frame to `index` — used as a fallback while
  // the exact frame is still in flight, so we never draw nothing.
  function nearestCached(index) {
    if (cache.has(index)) return cache.get(index);
    for (let d = 1; d < FRAME_COUNT; d++) {
      if (cache.has(index - d)) return cache.get(index - d);
      if (cache.has(index + d)) return cache.get(index + d);
    }
    return null;
  }

  for (let i = 0; i < INITIAL_BATCH; i++) {
    loadFrame(i, () => {
      initialLoaded++;
      const pct = Math.round((initialLoaded / INITIAL_BATCH) * 100);
      if (loaderFill) loaderFill.style.width = pct + "%";
      if (initialLoaded >= INITIAL_BATCH && !initialGateOpen) {
        initialGateOpen = true;
        revealReady();
      }
    });
  }
  ensureWindow(0);

  // Safety valve: never trap the visitor behind the loader.
  setTimeout(revealReady, 6000);

  /* ---------------------------------------------------------
     Single "ready" gate — flips once, drives both the content
     ripple and the background-media entrance. A session that
     already played the intro jumps straight to the settled state.
  --------------------------------------------------------- */
  let revealed = false;
  function revealReady() {
    if (revealed) return;
    revealed = true;
    const alreadyPlayed = sessionStorage.getItem("ehsanIntroPlayed") === "1";
    if (alreadyPlayed) html.classList.add("no-intro");
    else sessionStorage.setItem("ehsanIntroPlayed", "1");
    requestAnimationFrame(() => html.classList.add("is-ready"));
    // A tab that loaded in the background (opened from a link in a new
    // tab, etc.) has rAF throttled by the browser until it's shown, so
    // force one direct paint now rather than waiting on the loop.
    resizeCanvas();
    render();
    wake();
  }

  /* ---------------------------------------------------------
     Progress model
  --------------------------------------------------------- */
  let rawProgress = 0;
  let progress = 0; // smoothed / rendered value

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // Approximates cubic-bezier(0.25,1,0.5,1): quick start, long soft settle.
  function easeQuickSettle(t) { return 1 - Math.pow(1 - t, 3); }

  function readRawProgress() {
    const top = section.offsetTop;
    const scrollable = section.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return 0;
    return clamp((window.scrollY - top) / scrollable, 0, 1);
  }

  function panelStyle(p, start, inP, outP, end) {
    let t, opacity, ty;
    if (p <= start)      { opacity = 0; ty = 24; }
    else if (p < inP)    { t = easeQuickSettle((p - start) / (inP - start)); opacity = t; ty = 24 * (1 - t); }
    else if (p <= outP)  { opacity = 1; ty = 0; }
    else if (p < end)    { t = easeQuickSettle((p - outP) / (end - outP)); opacity = 1 - t; ty = -24 * t; }
    else                 { opacity = 0; ty = -24; }
    return { opacity, ty };
  }

  /* ---------------------------------------------------------
     Canvas cover-fit draw (mirrors CSS object-fit: cover),
     biased slightly upward so the tower tops stay in frame.
  --------------------------------------------------------- */
  function drawCover(img, alpha) {
    if (alpha <= 0 || !img.naturalWidth) return;
    const cw = canvas.width, ch = canvas.height;
    const ir = img.naturalWidth / img.naturalHeight;
    const cr = cw / ch;
    let sx, sy, sw, sh;
    if (ir > cr) {
      sh = img.naturalHeight; sw = sh * cr; sy = 0; sx = (img.naturalWidth - sw) / 2;
    } else {
      sw = img.naturalWidth; sh = sw / cr; sx = 0; sy = (img.naturalHeight - sh) * 0.38;
    }
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width  = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    wake();
  }

  /* ---------------------------------------------------------
     Render loop — only spins while the smoothed progress is
     still catching up to the raw scroll position (actively
     scrolling, or settling just after). At rest it fully stops
     rAF instead of redrawing an unchanged canvas 60x/sec, and a
     passive scroll/resize listener wakes it back up.
  --------------------------------------------------------- */
  let lastWindowCenter = -1;
  let rafHandle = null;

  function render() {
    const framePosition = progress * (FRAME_COUNT - 1);
    const current = Math.floor(framePosition);
    const next = Math.min(current + 1, FRAME_COUNT - 1);
    const frameT = framePosition - current;

    if (current !== lastWindowCenter) {
      lastWindowCenter = current;
      ensureWindow(current);
    }

    const currentImg = nearestCached(current);
    const nextImg = nearestCached(next);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (currentImg) drawCover(currentImg, 1);
    if (nextImg && nextImg !== currentImg) drawCover(nextImg, frameT);
    ctx.globalAlpha = 1;

    // Subtle continuous cinematic drift on the canvas itself —
    // separate element from .stage-reveal's one-shot entrance.
    const scale = 1 + progress * 0.035;
    const ty = -progress * 16;
    canvas.style.transform = `scale(${scale.toFixed(4)}) translateY(${ty.toFixed(2)}px)`;

    panels.forEach(panel => {
      const { opacity, ty } = panelStyle(progress, panel.__start, panel.__in, panel.__out, panel.__end);
      panel.style.opacity = opacity.toFixed(3);
      panel.style.transform = `translateY(${ty.toFixed(1)}px)`;
      panel.classList.toggle("is-visible", opacity > 0.02);
    });

    const activeFrame = clamp(Math.round(progress * (FRAME_COUNT - 1)) + 1, 1, FRAME_COUNT);
    if (railFill) railFill.style.height = (progress * 100).toFixed(1) + "%";
    if (telemetryFrame) telemetryFrame.textContent = String(activeFrame).padStart(3, "0");
  }

  function frameLoop() {
    rawProgress = readRawProgress();
    const settling = !reduceMotion && Math.abs(rawProgress - progress) > 0.0004;
    progress = settling ? lerp(progress, rawProgress, 0.09) : rawProgress;
    render();
    rafHandle = settling ? requestAnimationFrame(frameLoop) : null;
  }
  function wake() {
    if (rafHandle == null) rafHandle = requestAnimationFrame(frameLoop);
  }
  window.addEventListener("scroll", wake, { passive: true });
  window.addEventListener("resize", resizeCanvas, { passive: true });
  document.addEventListener("visibilitychange", () => { resizeCanvas(); wake(); });
  resizeCanvas();
  wake();
  // A tab that loads in the background (opened in a new tab, etc.) has
  // rAF throttled by the browser until it's actually shown, so wake()
  // alone can't guarantee a first paint. setInterval isn't throttled the
  // same way, so use it to force real resize+draw calls for the first
  // few seconds; it backs off as soon as the tab is genuinely visible.
  let paintGuardTicks = 0;
  const paintGuard = setInterval(() => {
    paintGuardTicks++;
    if (!document.hidden || paintGuardTicks > 24) { clearInterval(paintGuard); return; }
    resizeCanvas();
    render();
  }, 200);

  /* ---------------------------------------------------------
     Nav — scroll to a target progress fraction within the stage
  --------------------------------------------------------- */
  navButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const target = parseFloat(btn.dataset.navTarget);
      const top = section.offsetTop;
      const scrollable = section.offsetHeight - window.innerHeight;
      const destination = top + clamp(target, 0, 1) * scrollable;
      window.scrollTo({ top: destination, behavior: reduceMotion ? "auto" : "smooth" });
    });
  });
})();
