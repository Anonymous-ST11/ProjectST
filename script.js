/* ═══════════════════════════════════════════════════════════════
   script.js — Universe Dashboard · Cursor Photos · Scroll Particles
   ═══════════════════════════════════════════════════════════════

   HOW TO ADD MORE PHOTOS
   ─────────────────────────
   1. Drop image files into  assets/images/  named sequentially:
        7.jpg, 8.png, 9.jpeg …  (any mix of .jpg, .jpeg, .png)
   2. Update  CONFIG.TOTAL_IMAGES  below to match the highest number.
      That's it — the loader auto-detects the extension.

   ═══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   CONFIGURATION
   ══════════════════════════════════════════════════════════════ */
const CONFIG = {

  /* ── Images ──────────────────────────────────────────────── */
  TOTAL_IMAGES:      92,                   // ★ N — total photos in assets/images/
  IMAGE_PATH:        'assets/images/',    // folder prefix
  IMAGE_EXTENSIONS:  ['jpg', 'jpeg', 'png'],  // supported file types (tried in order)

  /* ── Wish Letter ───────────────────────────────────────── */
  WISH_PASSWORD:     'TMW132002', // ★ Change this to your desired password
  SPARKLE_COUNT:     50,                   // burst particles on unlock
  SPARKLE_LIFETIME:  1800,                 // ms

  /* ── Star field ──────────────────────────────────────────── */
  STAR_COUNT:        300,                 // number of stars
  STAR_MAX_SIZE:     2.2,                 // largest star radius (px)
  STAR_DRIFT:        0.12,               // base drift speed (px / frame)
  STAR_LAYERS:       3,                   // parallax layers (1–4)

  /* ── Cursor photo spawning ───────────────────────────────── */
  MAX_ONSCREEN:      30,                  // max DOM photo nodes alive
  LIFETIME:          2400,                // ms before fade-out starts
  FADE_IN:           320,                 // ms fade-in duration
  FADE_OUT:          550,                 // ms fade-out duration
  SIZE_MIN:          90,                  // smallest photo (px)
  SIZE_MAX:          210,                 // largest photo (px)
  SCATTER_RADIUS:    85,                  // random offset from cursor (px)
  ROTATION_RANGE:    20,                  // ±degrees
  SPAWN_THRESHOLD:   55,                  // min cursor travel before next spawn (px)
  EDGE_PAD:          16,                  // viewport edge padding (px)

  /* ── Scroll-triggered photo particles ────────────────────── */
  PARTICLE_IMAGE:    'assets/images/1',   // extension resolved by preloader
  PARTICLE_GRID:     4,                   // px per grid cell  →  smaller = more particles (was 6)
  PARTICLE_DISPLAY:  400,                 // assembled image max dimension (px)
  PARTICLE_SCATTER:  600,                 // max scatter distance (px)
  PARTICLE_FLOAT_AMP: 30,                // gentle floating amplitude (px)
  PARTICLE_FLOAT_SPD: 0.0008,            // floating speed multiplier
  PARTICLE_SCATTERED_OPACITY: 0.25,      // opacity cap after explosion (dimmer in other sections)

  /* ── Scroll phase mapping (0–1 of scroll progress) ──────── */
  PH_TEXT_START:     0.00,               // hero text starts fading
  PH_TEXT_END:       0.15,               // hero text fully invisible
  PH_APPEAR_START:   0.02,               // particles start appearing (assembled)
  PH_APPEAR_END:     0.14,               // particles fully assembled
  PH_EXPLODE_START:  0.15,               // explosion begins
  PH_EXPLODE_END:    0.55,               // explosion complete
  PH_FADE_START:     0.90,               // particles start fading out (very late)
  PH_FADE_END:       1.10,               // particles stay visible at full scroll
};


/* ══════════════════════════════════════════════════════════════
   UTILITIES
   ══════════════════════════════════════════════════════════════ */
const rand      = (a, b) => Math.random() * (b - a) + a;
const randInt   = (a, b) => Math.floor(rand(a, b + 1));
const clamp     = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp      = (a, b, t) => a + (b - a) * t;
const dist      = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const easeOut3  = t => 1 - Math.pow(1 - t, 3);
const easeOut4  = t => 1 - Math.pow(1 - t, 4);
const mapRange  = (v, inLo, inHi, outLo, outHi) =>
                    clamp((v - inLo) / (inHi - inLo), 0, 1) * (outHi - outLo) + outLo;


/* ══════════════════════════════════════════════════════════════
   DOM REFERENCES
   ══════════════════════════════════════════════════════════════ */
const $dashboard  = document.getElementById('dashboard');
const $heroText   = document.querySelector('.hero-text');
const $scrollHint = document.querySelector('.scroll-hint');
const $starCvs    = document.getElementById('star-canvas');
const $partCvs    = document.getElementById('particle-canvas');
const $sparkleCvs = document.getElementById('sparkle-canvas');
const starCtx     = $starCvs.getContext('2d');
const partCtx     = $partCvs.getContext('2d');
const sparkleCtx  = $sparkleCvs.getContext('2d');


/* ══════════════════════════════════════════════════════════════
   IMAGE PRE-LOADER  (auto-detects .jpg / .jpeg / .png per index)
   ══════════════════════════════════════════════════════════════ */
const imageSources = [];   // filled after probing
const preloaded    = [];

/**
 * For each index 1…N, try each extension in CONFIG.IMAGE_EXTENSIONS
 * order. The first one that loads wins. Returns a Promise that
 * resolves once every index has been probed.
 */
function probeImage(index) {
  return new Promise((resolve) => {
    const exts = CONFIG.IMAGE_EXTENSIONS;
    let tried = 0;
    function tryNext() {
      if (tried >= exts.length) {
        // Fallback: use first extension even if broken — avoids empty array
        resolve(CONFIG.IMAGE_PATH + index + '.' + exts[0]);
        return;
      }
      const src = CONFIG.IMAGE_PATH + index + '.' + exts[tried];
      const img = new Image();
      img.onload = () => resolve(src);
      img.onerror = () => { tried++; tryNext(); };
      img.src = src;
    }
    tryNext();
  });
}

const imageProbePromise = Promise.all(
  Array.from({ length: CONFIG.TOTAL_IMAGES }, (_, i) => probeImage(i + 1))
).then(resolvedSrcs => {
  resolvedSrcs.forEach(src => imageSources.push(src));
  // Pre-load into browser cache
  imageSources.forEach(src => {
    const img = new Image();
    img.src = src;
    preloaded.push(img);
  });
  // Update particle image to use resolved first image
  if (imageSources.length > 0) {
    CONFIG.PARTICLE_IMAGE = imageSources[0];
  }
});


/* ══════════════════════════════════════════════════════════════
   1.  STAR FIELD  (Canvas)
   ══════════════════════════════════════════════════════════════ */
let stars = [];

function initStars() {
  stars = [];
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < CONFIG.STAR_COUNT; i++) {
    const layer = randInt(1, CONFIG.STAR_LAYERS);
    stars.push({
      x:        rand(0, w),
      y:        rand(0, h),
      r:        rand(0.4, CONFIG.STAR_MAX_SIZE) * (layer / CONFIG.STAR_LAYERS),
      layer,
      speed:    CONFIG.STAR_DRIFT * layer * rand(0.6, 1.4),
      baseA:    rand(0.35, 0.9),
      twinkle:  rand(0.001, 0.004),
      phase:    rand(0, Math.PI * 2),
      hue:      rand(0, 1) < 0.12 ? rand(200, 240) : rand(0, 1) < 0.06 ? 35 : 0,
    });
  }
}

function drawStars(time, opacity) {
  const w = $starCvs.width;
  const h = $starCvs.height;
  starCtx.clearRect(0, 0, w, h);
  if (opacity <= 0) return;

  for (const s of stars) {
    // Drift
    s.x -= s.speed;
    if (s.x < -4) s.x = w + 4;

    // Twinkle
    const flicker = s.baseA + 0.25 * Math.sin(time * s.twinkle + s.phase);
    const a = clamp(flicker, 0.1, 1) * opacity;

    starCtx.beginPath();
    starCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);

    if (s.hue) {
      starCtx.fillStyle = `hsla(${s.hue}, 60%, 80%, ${a})`;
    } else {
      starCtx.fillStyle = `rgba(255,255,255,${a})`;
    }
    starCtx.fill();
  }
}


/* ══════════════════════════════════════════════════════════════
   2.  CURSOR PHOTO SPAWNING  (DOM)
   ══════════════════════════════════════════════════════════════ */
const livePhotos  = [];
let lastCX        = -Infinity;
let lastCY        = -Infinity;
let zCounter      = 1;
let imgCycleIdx   = 0;
let pendingSpawn  = null;
let photosEnabled = true;

function spawnPhoto(cx, cy) {
  // Enforce cap
  while (livePhotos.length >= CONFIG.MAX_ONSCREEN) killPhoto(livePhotos[0]);

  const size  = randInt(CONFIG.SIZE_MIN, CONFIG.SIZE_MAX);
  const half  = size / 2;
  const angle = rand(-CONFIG.ROTATION_RANGE, CONFIG.ROTATION_RANGE);
  const ox    = rand(-CONFIG.SCATTER_RADIUS, CONFIG.SCATTER_RADIUS);
  const oy    = rand(-CONFIG.SCATTER_RADIUS, CONFIG.SCATTER_RADIUS);
  const pad   = CONFIG.EDGE_PAD;
  const vw    = window.innerWidth;
  const vh    = window.innerHeight;
  const x     = clamp(cx + ox - half, pad, vw - size - pad);
  const y     = clamp(cy + oy - half, pad, vh - size - pad);

  const el = document.createElement('img');
  el.className = 'cursor-photo';
  el.src       = imageSources[imgCycleIdx % imageSources.length];
  imgCycleIdx++;

  el.style.left      = x + 'px';
  el.style.top       = y + 'px';
  el.style.width     = size + 'px';
  el.style.height    = size + 'px';
  el.style.zIndex    = zCounter++;
  el.style.transition = `opacity ${CONFIG.FADE_IN}ms cubic-bezier(.22,1,.36,1),
                          transform ${CONFIG.FADE_IN}ms cubic-bezier(.22,1,.36,1)`;

  document.body.appendChild(el);
  el.getBoundingClientRect();                       // force reflow
  el.style.opacity   = '1';
  el.style.transform = `scale(1) rotate(${angle}deg)`;

  const desc  = { el, timer: null };
  desc.timer  = setTimeout(() => fadePhoto(desc), CONFIG.LIFETIME);
  livePhotos.push(desc);
}

function fadePhoto(d) {
  d.el.style.transition = `opacity ${CONFIG.FADE_OUT}ms cubic-bezier(.22,1,.36,1),
                            transform ${CONFIG.FADE_OUT}ms cubic-bezier(.22,1,.36,1)`;
  d.el.style.opacity    = '0';
  d.el.style.transform += ' scale(0.55)';
  setTimeout(() => killPhoto(d), CONFIG.FADE_OUT);
}

function killPhoto(d) {
  clearTimeout(d.timer);
  if (d.el.parentNode) d.el.parentNode.removeChild(d.el);
  const i = livePhotos.indexOf(d);
  if (i !== -1) livePhotos.splice(i, 1);
}

function clearAllPhotos() {
  while (livePhotos.length) killPhoto(livePhotos[0]);
}

// Pointer handler (rAF-throttled + distance gated)
function onPointerMove(e) {
  if (!photosEnabled) return;
  const mx = e.clientX, my = e.clientY;
  if (dist(mx, my, lastCX, lastCY) < CONFIG.SPAWN_THRESHOLD) return;
  lastCX = mx;  lastCY = my;
  if (pendingSpawn) return;
  pendingSpawn = { x: mx, y: my };
  requestAnimationFrame(() => {
    if (pendingSpawn) {
      spawnPhoto(pendingSpawn.x, pendingSpawn.y);
      pendingSpawn = null;
    }
  });
}

$dashboard.addEventListener('pointermove', onPointerMove, { passive: true });
document.addEventListener('pointerleave', () => { lastCX = lastCY = -Infinity; });


/* ══════════════════════════════════════════════════════════════
   3.  SCROLL-TRIGGERED PHOTO PARTICLES  (Canvas)
   ══════════════════════════════════════════════════════════════ */
let particles        = [];
let particleImgReady = false;
const particleImg    = new Image();

particleImg.onload = function () {
  particleImgReady = true;
  buildParticles();
};

// Load particle image after extension probing completes
imageProbePromise.then(() => {
  particleImg.src = CONFIG.PARTICLE_IMAGE;
});

function buildParticles() {
  particles = [];
  const img = particleImg;
  const nat = { w: img.naturalWidth, h: img.naturalHeight };
  if (!nat.w || !nat.h) return;

  // Determine displayed size (fit within PARTICLE_DISPLAY keeping aspect)
  const scale = Math.min(CONFIG.PARTICLE_DISPLAY / nat.w, CONFIG.PARTICLE_DISPLAY / nat.h);
  const dw    = Math.round(nat.w * scale);
  const dh    = Math.round(nat.h * scale);

  // Draw to offscreen canvas at displayed size to sample colours
  const off    = document.createElement('canvas');
  off.width    = dw;
  off.height   = dh;
  const offCtx = off.getContext('2d');
  offCtx.drawImage(img, 0, 0, dw, dh);
  const data   = offCtx.getImageData(0, 0, dw, dh).data;

  const grid   = CONFIG.PARTICLE_GRID;
  const cx     = window.innerWidth  / 2;
  const cy     = window.innerHeight / 2;
  const ox     = cx - dw / 2;
  const oy     = cy - dh / 2;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 40; // keep away from edges

  for (let py = 0; py < dh; py += grid) {
    for (let px = 0; px < dw; px += grid) {
      const idx = (py * dw + px) * 4;
      const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
      if (a < 30) continue;                      // skip transparent pixels

      // Assembled position (forming the image, viewport-centered)
      const ax = ox + px;
      const ay = oy + py;

      // Direction from image centre → this point
      const angle    = Math.atan2(ay - cy, ax - cx);
      const distC    = Math.hypot(ax - cx, ay - cy);

      // Scatter to RANDOM positions across entire viewport (all directions)
      const sx = rand(margin, vw - margin);
      const sy = rand(margin, vh - margin);

      // Stagger based on distance from centre  (centre explodes first)
      const maxDist = Math.hypot(dw / 2, dh / 2) || 1;
      const delay   = (distC / maxDist) * 0.35;

      particles.push({
        // assembled
        ax, ay,
        // scattered
        sx, sy,
        // colour
        r, g, b, a: a / 255,
        // radius (circle)
        radius: grid / 2,
        endRadius: (grid / 2) * rand(0.3, 0.7),
        // stagger
        delay,
        // per-particle float phase (for gentle drift after scattering)
        floatPhase: rand(0, Math.PI * 2),
        floatFreq:  rand(0.7, 1.3),
      });
    }
  }
}

function drawParticles(scrollProgress, time) {
  const w = $partCvs.width;
  const h = $partCvs.height;
  partCtx.clearRect(0, 0, w, h);

  if (!particleImgReady || particles.length === 0) return;

  // Phase mappings
  const appearT  = mapRange(scrollProgress, CONFIG.PH_APPEAR_START,  CONFIG.PH_APPEAR_END,  0, 1);
  const explodeT = mapRange(scrollProgress, CONFIG.PH_EXPLODE_START, CONFIG.PH_EXPLODE_END, 0, 1);
  const fadeT    = clamp(mapRange(scrollProgress, CONFIG.PH_FADE_START, CONFIG.PH_FADE_END, 1, 0), 0, 1);

  if (appearT <= 0) return;

  // Effective fade can stay at 1 if PH_FADE_END > 1
  const visFade = Math.max(fadeT, 0);
  if (visFade <= 0 && appearT <= 0) return;

  const easedExplode = easeOut3(explodeT);
  const floatAmp = CONFIG.PARTICLE_FLOAT_AMP;
  const floatSpd = CONFIG.PARTICLE_FLOAT_SPD;

  for (let i = 0, len = particles.length; i < len; i++) {
    const p = particles[i];

    // Per-particle staggered explosion progress
    const localT = clamp((easedExplode - p.delay) / (1 - p.delay + 0.001), 0, 1);
    const et     = easeOut4(localT);

    // Interpolate position
    let x = lerp(p.ax, p.sx, et);
    let y = lerp(p.ay, p.sy, et);

    // Gentle floating drift after explosion
    if (et > 0.1) {
      const drift = et * floatAmp;
      x += Math.sin(time * floatSpd * p.floatFreq + p.floatPhase) * drift;
      y += Math.cos(time * floatSpd * p.floatFreq * 0.7 + p.floatPhase) * drift * 0.8;
    }

    // Interpolate radius (circle)
    const rd = lerp(p.radius, p.endRadius, et);

    // Opacity: full when assembled, reduced when scattered (dimmer in other sections)
    const scatteredDim = lerp(1, CONFIG.PARTICLE_SCATTERED_OPACITY, et);
    const alpha = appearT * Math.max(visFade, 0.0) * p.a * scatteredDim;
    if (alpha < 0.01) continue;

    partCtx.globalAlpha = alpha;
    partCtx.fillStyle   = `rgb(${p.r},${p.g},${p.b})`;

    // Draw circle
    partCtx.beginPath();
    partCtx.arc(x, y, rd, 0, Math.PI * 2);
    partCtx.fill();
  }

  partCtx.globalAlpha = 1;
}


/* ══════════════════════════════════════════════════════════════
   4.  SCROLL CONTROLLER
   ══════════════════════════════════════════════════════════════ */
let scrollProgress = 0;

/* Scroll progress is computed from dashboard top to home section bottom.
   This keeps particle phases consistent regardless of how many sections exist. */
function updateScroll() {
  const dashH = $dashboard.offsetHeight;
  const homeH = document.getElementById('home').offsetHeight;
  const twoSectionScroll = dashH + homeH - window.innerHeight;
  scrollProgress = twoSectionScroll > 0 ? clamp(window.scrollY / twoSectionScroll, 0, 1) : 0;

  // Hero text fade
  const textOpacity   = 1 - mapRange(scrollProgress, CONFIG.PH_TEXT_START, CONFIG.PH_TEXT_END, 0, 1);
  const textScale     = lerp(1, 0.92, 1 - textOpacity);
  $heroText.style.opacity   = textOpacity;
  $heroText.style.transform = `scale(${textScale})`;

  // Scroll hint fade
  $scrollHint.style.opacity = textOpacity;

  // Enable/disable cursor photos based on scroll
  const wasEnabled = photosEnabled;
  photosEnabled = scrollProgress < 0.08;
  if (!photosEnabled && wasEnabled) clearAllPhotos();
}

window.addEventListener('scroll', updateScroll, { passive: true });


/* ══════════════════════════════════════════════════════════════
   5.  RESIZE HANDLER
   ══════════════════════════════════════════════════════════════ */
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w   = window.innerWidth;
  const h   = window.innerHeight;

  $starCvs.width  = w * dpr;
  $starCvs.height = h * dpr;
  starCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  $partCvs.width  = w * dpr;
  $partCvs.height = h * dpr;
  partCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Sparkle canvas fills its parent section
  const wishRect     = document.getElementById('wish').getBoundingClientRect();
  $sparkleCvs.width  = wishRect.width * dpr;
  $sparkleCvs.height = wishRect.height * dpr;
  sparkleCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  initStars();
  if (particleImgReady) buildParticles();
}

window.addEventListener('resize', resize);


/* ══════════════════════════════════════════════════════════════
   6.  MAIN ANIMATION LOOP
   ══════════════════════════════════════════════════════════════ */
function animate(time) {
  // Stars — stay faintly visible even in home section
  const starOpacity = lerp(1, 0.2, mapRange(scrollProgress, 0.2, 0.7, 0, 1));
  drawStars(time, starOpacity);

  // Scroll particles (pass time for floating animation)
  drawParticles(scrollProgress, time);

  // Sparkles (envelope unlock burst)
  drawSparkles(time);

  requestAnimationFrame(animate);
}


/* ══════════════════════════════════════════════════════════════
   7.  WISH LETTER — PASSWORD GATE + ENVELOPE + FULL-PAPER LETTER
   ══════════════════════════════════════════════════════════════ */
const $wishSection = document.getElementById('wish');
const $envelope    = document.getElementById('envelope');
const $seal        = document.getElementById('envelope-seal');
const $wishInput   = document.getElementById('wish-input');
const $wishBtn     = document.getElementById('wish-btn');
const $wishMsg     = document.getElementById('wish-msg');
const $wishGate    = document.getElementById('wish-gate');
const $letterPaper = document.getElementById('letter-paper');
let envelopeOpen   = false;

function attemptOpen() {
  if (envelopeOpen) return;
  const val = $wishInput.value.trim();
  if (!val) return;

  if (val === CONFIG.WISH_PASSWORD) {
    envelopeOpen = true;

    // Success feedback
    $wishMsg.textContent = 'Unlocked!';
    $wishMsg.className   = 'wish-msg is-success';

    // ── Multi-stage animation ─────────────────────────────
    // Step 1 (t=0): Seal fades + flap opens (CSS .is-open)
    $envelope.classList.add('is-open');

    // Sparkle burst at seal center
    burstSparkles();

    // Step 2 (t=600ms): Hide password gate
    setTimeout(() => {
      $wishGate.classList.add('is-hidden');
    }, 600);

    // Step 3 (t=1200ms): Fade out the entire wrap (title, envelope)
    //                     and expand the letter paper
    setTimeout(() => {
      $wishSection.classList.add('is-unlocked');
    }, 1200);
  } else {
    // Error feedback with shake
    $wishMsg.textContent = 'Wrong password';
    $wishMsg.className   = 'wish-msg is-error';
    void $wishMsg.offsetWidth;
    $wishMsg.classList.remove('is-error');
    requestAnimationFrame(() => $wishMsg.classList.add('is-error'));
  }
}

$wishBtn.addEventListener('click', attemptOpen);
$wishInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') attemptOpen();
});


/* ══════════════════════════════════════════════════════════════
   8.  SPARKLE BURST  (Canvas, on envelope unlock)
   ══════════════════════════════════════════════════════════════ */
let sparkles     = [];
let sparkleStart = 0;

function burstSparkles() {
  sparkles = [];
  sparkleStart = performance.now();
  // Centre of envelope relative to #wish section
  const wishRect = document.getElementById('wish').getBoundingClientRect();
  const envRect  = $envelope.getBoundingClientRect();
  const cx = envRect.left + envRect.width / 2 - wishRect.left;
  const cy = envRect.top  + envRect.height / 2 - wishRect.top;

  for (let i = 0; i < CONFIG.SPARKLE_COUNT; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(80, 240);
    const hue   = rand(0, 1) < 0.5 ? rand(200, 260) : rand(35, 55); // blue / gold
    sparkles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: rand(2, 5),
      hue,
      life: 1,               // 1 → 0
      decay: 1 / (CONFIG.SPARKLE_LIFETIME / 16.67 * rand(0.7, 1.3)),
    });
  }
}

function drawSparkles(time) {
  const cw = $sparkleCvs.width  / (window.devicePixelRatio || 1);
  const ch = $sparkleCvs.height / (window.devicePixelRatio || 1);
  sparkleCtx.clearRect(0, 0, cw, ch);
  if (sparkles.length === 0) return;

  const dt = 1 / 60; // normalised delta
  let alive = false;

  for (let i = sparkles.length - 1; i >= 0; i--) {
    const s = sparkles[i];
    s.life -= s.decay;
    if (s.life <= 0) { sparkles.splice(i, 1); continue; }
    alive = true;

    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 60 * dt;            // slight gravity
    s.vx *= 0.985;              // friction
    s.vy *= 0.985;

    const a = s.life * 0.9;
    sparkleCtx.globalAlpha = a;
    sparkleCtx.fillStyle = `hsla(${s.hue}, 80%, 72%, ${a})`;
    sparkleCtx.beginPath();
    sparkleCtx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
    sparkleCtx.fill();
  }
  sparkleCtx.globalAlpha = 1;
}


/* ══════════════════════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════════════════════ */
resize();
updateScroll();
requestAnimationFrame(animate);


/* ══════════════════════════════════════════════════════════════
   9.  PIXEL MUSIC PLAYER  (Songs Section — Carousel + Audio)
   ══════════════════════════════════════════════════════════════

   ★ CHANGE TRACK LIST HERE — edit titles, artists, audio & image paths
   ══════════════════════════════════════════════════════════════ */
const TRACK_LIST = [
  /* ─ audioSrc ─────────────────  ─ title ─────────────────  ─ artist ─────────────────  ─ coverSrc (pixel CD) ──────── */
  { src: 'assets/songs/1.mp3', title: 'Two Year',            artist: 'Rose',                   img: 'assets/images/pixel/1.png' },
  { src: 'assets/songs/2.mp3', title: 'About You',           artist: 'The 1975',                img: 'assets/images/pixel/2.png' },
  { src: 'assets/songs/3.mp3', title: 'Kiseki',              artist: 'GReeeeN',                 img: 'assets/images/pixel/3.png' },
  { src: 'assets/songs/4.mp3', title: 'Rewrite the Stars',   artist: 'Zac Efron, Zendaya',      img: 'assets/images/pixel/4.png' },
  { src: 'assets/songs/5.mp3', title: 'Somebody to You',     artist: 'The Vamps',                img: 'assets/images/pixel/5.png' },
];

/* ── State ────────────────────────────────────────────────── */
let spCurrentIdx   = 0;    // currently loaded track
let spSlideIdx     = 0;    // visible carousel slide
let spIsPlaying    = false;

/* ── DOM refs ─────────────────────────────────────────────── */
const $audio          = document.getElementById('songs-audio');
const $carouselTrack  = document.getElementById('songs-carousel-track');
const $scPrev         = document.getElementById('sc-prev');
const $scNext         = document.getElementById('sc-next');
const $scDots         = document.getElementById('sc-dots');
const $spPlay         = document.getElementById('sp-play');
const $spPrev         = document.getElementById('sp-prev');
const $spNext         = document.getElementById('sp-next');
const $spNowTitle     = document.getElementById('sp-now-title');
const $spNowArtist    = document.getElementById('sp-now-artist');
const $spTimeCur      = document.getElementById('sp-time-cur');
const $spTimeDur      = document.getElementById('sp-time-dur');
const $spProgressBar  = document.getElementById('sp-progress-bar');
const $spProgressFill = document.getElementById('sp-progress-fill');
const $spVolume       = document.getElementById('sp-volume');

/* ══════════════════════════════════════════════════════════
   9a.  BUILD CAROUSEL SLIDES + DOTS
   ══════════════════════════════════════════════════════════ */
function buildSlides() {
  $carouselTrack.innerHTML = '';
  $scDots.innerHTML = '';

  TRACK_LIST.forEach((track, i) => {
    /* ── Slide ─────────────────────────────────────────── */
    const slide = document.createElement('div');
    slide.className = 'song-slide' + (i === 0 ? ' is-active' : '');
    slide.dataset.index = i;
    slide.innerHTML = `
      <div class="song-cd-wrap">
        <img class="song-cd" src="${track.img}" alt="${track.title}" draggable="false" />
        <div class="song-cd-hole"></div>
      </div>
      <div class="song-slide-info">
        <span class="song-name">${track.title}</span>
        <span class="song-artist">${track.artist}</span>
      </div>
      <button class="song-play-btn" title="Play / Pause">
        <svg class="sbtn-play" viewBox="0 0 16 16" fill="currentColor"><polygon points="3,1 13,8 3,15"/></svg>
        <svg class="sbtn-pause" viewBox="0 0 16 16" fill="currentColor" style="display:none"><rect x="2" y="1" width="4" height="14"/><rect x="10" y="1" width="4" height="14"/></svg>
      </button>
      <div class="song-progress-wrap">
        <span class="song-time song-time-cur">0:00</span>
        <div class="song-progress-bar"><div class="song-progress-fill"></div></div>
        <span class="song-time song-time-dur">0:00</span>
      </div>
    `;
    $carouselTrack.appendChild(slide);

    /* ── Dot ──────────────────────────────────────────── */
    const dot = document.createElement('button');
    dot.className = 'sc-dot' + (i === 0 ? ' is-active' : '');
    dot.dataset.index = i;
    dot.title = `Track ${i + 1}`;
    $scDots.appendChild(dot);
  });
}
buildSlides();

/* ══════════════════════════════════════════════════════════
   9b.  CAROUSEL NAVIGATION
   ══════════════════════════════════════════════════════════ */
function getAllSlides() {
  return Array.from($carouselTrack.querySelectorAll('.song-slide'));
}
function getAllDots() {
  return Array.from($scDots.querySelectorAll('.sc-dot'));
}

function goToSlide(idx) {
  const total = TRACK_LIST.length;
  idx = ((idx % total) + total) % total;
  spSlideIdx = idx;

  // Move track
  $carouselTrack.style.transform = `translateX(-${idx * 100}%)`;

  // Update active class (for opacity fade)
  getAllSlides().forEach((s, i) => {
    s.classList.toggle('is-active', i === idx);
  });

  // Update dots
  getAllDots().forEach((d, i) => {
    d.classList.toggle('is-active', i === idx);
  });

  // If audio is currently playing, switch to this track seamlessly
  if (spIsPlaying) {
    spLoadTrack(idx);
    spPlay();
  } else {
    // Just update the "loaded" track so play button works on current slide
    spLoadTrack(idx);
  }
}

/* ── Arrow & dot events ───────────────────────────────── */
$scPrev.addEventListener('click', () => goToSlide(spSlideIdx - 1));
$scNext.addEventListener('click', () => goToSlide(spSlideIdx + 1));
$scDots.addEventListener('click', (e) => {
  const dot = e.target.closest('.sc-dot');
  if (!dot) return;
  goToSlide(parseInt(dot.dataset.index, 10));
});

/* ══════════════════════════════════════════════════════════
   9c.  AUDIO PLAYER FUNCTIONS
   ══════════════════════════════════════════════════════════ */
function fmtTime(s) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

function spLoadTrack(idx) {
  if (idx < 0 || idx >= TRACK_LIST.length) return;
  spCurrentIdx = idx;
  const track = TRACK_LIST[idx];

  $audio.src = track.src;
  $audio.load();

  // Update now-playing bar info
  $spNowTitle.textContent  = track.title;
  $spNowArtist.textContent = track.artist;

  // Reset global progress
  $spProgressFill.style.width = '0%';
  $spTimeCur.textContent = '0:00';
  $spTimeDur.textContent = '0:00';

  // Reset all slide UI
  getAllSlides().forEach((s) => {
    s.classList.remove('is-playing', 'is-paused');
    const fill = s.querySelector('.song-progress-fill');
    if (fill) fill.style.width = '0%';
    const cur = s.querySelector('.song-time-cur');
    if (cur) cur.textContent = '0:00';
    const dur = s.querySelector('.song-time-dur');
    if (dur) dur.textContent = '0:00';
    resetSlideIcons(s);
  });
}

function resetSlideIcons(slide) {
  const sp = slide.querySelector('.sbtn-play');
  const pp = slide.querySelector('.sbtn-pause');
  if (sp) sp.style.display = '';
  if (pp) pp.style.display = 'none';
}

function spPlay() {
  if (spCurrentIdx < 0) spLoadTrack(0);
  $audio.play().catch(() => {});
  spIsPlaying = true;
  updatePlayState();
}

function spPause() {
  $audio.pause();
  spIsPlaying = false;
  updatePlayState();
}

function spToggle() {
  if (spIsPlaying) spPause();
  else spPlay();
}

function spNextTrack() {
  const next = (spCurrentIdx + 1) % TRACK_LIST.length;
  goToSlide(next);
  // goToSlide handles loadTrack + play if was playing
  if (!spIsPlaying) {
    spLoadTrack(next);
    spPlay();
  }
}

function spPrevTrack() {
  if ($audio.currentTime > 3) {
    $audio.currentTime = 0;
    return;
  }
  const prev = (spCurrentIdx - 1 + TRACK_LIST.length) % TRACK_LIST.length;
  goToSlide(prev);
  if (!spIsPlaying) {
    spLoadTrack(prev);
    spPlay();
  }
}

/* ── Update play/pause UI state across all elements ─────── */
function updatePlayState() {
  // Global bar icons
  const playIcon  = $spPlay.querySelector('.sp-icon-play');
  const pauseIcon = $spPlay.querySelector('.sp-icon-pause');
  if (spIsPlaying) {
    playIcon.style.display  = 'none';
    pauseIcon.style.display = '';
  } else {
    playIcon.style.display  = '';
    pauseIcon.style.display = 'none';
  }

  // Slide-level icons + CD state
  getAllSlides().forEach((s, i) => {
    const sp = s.querySelector('.sbtn-play');
    const pp = s.querySelector('.sbtn-pause');

    if (i === spCurrentIdx) {
      if (spIsPlaying) {
        s.classList.add('is-playing');
        s.classList.remove('is-paused');
        if (sp) sp.style.display = 'none';
        if (pp) pp.style.display = '';
      } else {
        s.classList.remove('is-playing');
        s.classList.add('is-paused');
        if (sp) sp.style.display = '';
        if (pp) pp.style.display = 'none';
      }
    } else {
      s.classList.remove('is-playing', 'is-paused');
      if (sp) sp.style.display = '';
      if (pp) pp.style.display = 'none';
    }
  });
}

/* ── Progress & time updates ──────────────────────────────── */
function updateProgress() {
  if (!isFinite($audio.duration)) return;
  const pct = ($audio.currentTime / $audio.duration) * 100;

  // Global bar
  $spProgressFill.style.width = pct + '%';
  $spTimeCur.textContent = fmtTime($audio.currentTime);

  // Active slide bar
  const slide = getAllSlides()[spCurrentIdx];
  if (slide) {
    const fill = slide.querySelector('.song-progress-fill');
    if (fill) fill.style.width = pct + '%';
    const cur = slide.querySelector('.song-time-cur');
    if (cur) cur.textContent = fmtTime($audio.currentTime);
  }
}

$audio.addEventListener('timeupdate', updateProgress);

$audio.addEventListener('loadedmetadata', () => {
  $spTimeDur.textContent = fmtTime($audio.duration);
  const slide = getAllSlides()[spCurrentIdx];
  if (slide) {
    const dur = slide.querySelector('.song-time-dur');
    if (dur) dur.textContent = fmtTime($audio.duration);
  }
});

$audio.addEventListener('ended', () => {
  // Auto-advance to next track and play (loop after last)
  const next = (spCurrentIdx + 1) % TRACK_LIST.length;
  goToSlide(next);
  // Force play regardless
  spLoadTrack(next);
  spPlay();
});

/* ── Seeking (global bar) ─────────────────────────────────── */
let spSeeking = false;

function spSeek(e) {
  const rect = $spProgressBar.getBoundingClientRect();
  const pct  = clamp((e.clientX - rect.left) / rect.width, 0, 1);
  if (isFinite($audio.duration)) {
    $audio.currentTime = pct * $audio.duration;
  }
}

$spProgressBar.addEventListener('mousedown', (e) => { spSeeking = true; spSeek(e); });
document.addEventListener('mousemove', (e) => { if (spSeeking) spSeek(e); });
document.addEventListener('mouseup', () => { spSeeking = false; });
$spProgressBar.addEventListener('touchstart', (e) => { spSeeking = true; spSeek(e.touches[0]); }, { passive: true });
document.addEventListener('touchmove', (e) => { if (spSeeking) spSeek(e.touches[0]); }, { passive: true });
document.addEventListener('touchend', () => { spSeeking = false; });

/* ── Seeking on slide progress bar ────────────────────────── */
$carouselTrack.addEventListener('click', (e) => {
  const bar = e.target.closest('.song-progress-bar');
  if (!bar) return;
  e.stopPropagation();
  const slide = bar.closest('.song-slide');
  if (!slide) return;
  const idx = parseInt(slide.dataset.index, 10);
  if (idx !== spCurrentIdx) return;
  const rect = bar.getBoundingClientRect();
  const pct  = clamp((e.clientX - rect.left) / rect.width, 0, 1);
  if (isFinite($audio.duration)) {
    $audio.currentTime = pct * $audio.duration;
  }
}, true);

/* ── Volume ───────────────────────────────────────────────── */
$spVolume.addEventListener('input', () => {
  $audio.volume = parseFloat($spVolume.value);
});
$audio.volume = 0.7;

/* ── Button events ────────────────────────────────────────── */
$spPlay.addEventListener('click', spToggle);
$spPrev.addEventListener('click', spPrevTrack);
$spNext.addEventListener('click', spNextTrack);

/* ── Slide play button click ──────────────────────────────── */
$carouselTrack.addEventListener('click', (e) => {
  const btn = e.target.closest('.song-play-btn');
  if (!btn) return;
  const slide = btn.closest('.song-slide');
  if (!slide) return;
  const idx = parseInt(slide.dataset.index, 10);

  if (idx === spCurrentIdx) {
    spToggle();
  } else {
    goToSlide(idx);
    spLoadTrack(idx);
    spPlay();
  }
});

/* ── Initial load (first track, paused) ──────────────────── */
spLoadTrack(0);


/* ══════════════════════════════════════════════════════════════
   10.  PARTICLE PHOTO UNIVERSE  (Section D)
   ══════════════════════════════════════════════════════════════

   ★ CONFIG — change these to tune the effect
   ══════════════════════════════════════════════════════════════ */
const PU = {
  TOTAL_IMAGES:         CONFIG.TOTAL_IMAGES,  // reuse global image count
  IMAGE_PATH:           CONFIG.IMAGE_PATH,    // reuse global path
  MAX_VISIBLE:          16,                   // photo elements in the pool
  ORBIT_RADIUS:         250,                  // base orbit radius (px, before variance)
  DEPTH_RANGE:          600,                  // ±z depth spread (px)
  FEATURE_INTERVAL_MS:  5000,                 // ms between featured photo highlights
  ORBIT_SPEED:          0.00012,              // radians / ms base orbit speed
  DRIFT_SPEED:          0.00008,              // radians / ms secondary drift
  LOCAL_STAR_COUNT:      160,                 // stars drawn on section canvas
};

/* ── State ────────────────────────────────────────────────── */
let puPhotos         = [];      // object pool
let puRunning        = false;
let puAnimId         = null;
let puLastTime       = 0;
let puFeatureTimer   = null;
let puFeaturedIdx    = -1;

/* ── DOM refs ─────────────────────────────────────────────── */
const $puSection      = document.getElementById('photo-universe');
const $puStage        = $puSection.querySelector('.pu-stage');
const $puStarsCvs     = $puSection.querySelector('.pu-stars-canvas');
const $puFeatFrame    = document.getElementById('pu-featured-frame');
const $puFeatImg      = document.getElementById('pu-featured-img');
const puStarsCtx      = $puStarsCvs.getContext('2d');

/* ══════════════════════════════════════════════════════════════
   10a.  LOCAL STAR FIELD  (drawn once on the section canvas)
   ══════════════════════════════════════════════════════════════ */
function puDrawStars() {
  const dpr = window.devicePixelRatio || 1;
  const w   = $puSection.offsetWidth;
  const h   = $puSection.offsetHeight;
  $puStarsCvs.width  = w * dpr;
  $puStarsCvs.height = h * dpr;
  puStarsCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  for (let i = 0; i < PU.LOCAL_STAR_COUNT; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() * 1.6 + 0.3;
    const a = Math.random() * 0.5 + 0.25;
    puStarsCtx.beginPath();
    puStarsCtx.arc(x, y, r, 0, Math.PI * 2);
    puStarsCtx.fillStyle = `rgba(255,255,255,${a})`;
    puStarsCtx.fill();
  }
}

/* ══════════════════════════════════════════════════════════════
   10b.  PHOTO POOL  — create DOM elements + initial orbit data
   ══════════════════════════════════════════════════════════════ */
function puInitPool() {
  // Cleanup previous if any
  puPhotos.forEach(p => p.el.remove());
  puPhotos = [];

  for (let i = 0; i < PU.MAX_VISIBLE; i++) {
    const el = document.createElement('img');
    el.className = 'pu-photo';
    el.draggable = false;
    // Cycle through available images (use resolved sources if ready)
    const imgIdx = (i % PU.TOTAL_IMAGES);
    el.src = imageSources.length > 0
      ? imageSources[imgIdx]
      : PU.IMAGE_PATH + (imgIdx + 1) + '.jpg';
    $puStage.appendChild(el);

    // Give each photo a unique orbit slot
    const angleOffset = (Math.PI * 2 / PU.MAX_VISIBLE) * i + rand(-0.3, 0.3);
    const orbitR      = PU.ORBIT_RADIUS * rand(0.45, 1.5);
    const zBase       = rand(-PU.DEPTH_RANGE, PU.DEPTH_RANGE);
    const tiltX       = rand(-18, 18);   // degrees
    const tiltY       = rand(-18, 18);
    const sizeVar     = rand(0.7, 1.3);  // scale multiplier for variety
    const driftPhase  = rand(0, Math.PI * 2);
    const driftAmpX   = rand(20, 80);
    const driftAmpY   = rand(15, 60);
    const orbitDir    = Math.random() < 0.5 ? 1 : -1;

    puPhotos.push({
      el,
      angleOffset,
      orbitR,
      zBase,
      tiltX,
      tiltY,
      sizeVar,
      driftPhase,
      driftAmpX,
      driftAmpY,
      orbitDir,
      currentAngle: angleOffset,
    });
  }
}

/* ══════════════════════════════════════════════════════════════
   10c.  ANIMATION LOOP
   ══════════════════════════════════════════════════════════════ */
function puAnimate(time) {
  if (!puRunning) return;
  puAnimId = requestAnimationFrame(puAnimate);

  if (!puLastTime) { puLastTime = time; return; }
  const dt = time - puLastTime;
  puLastTime = time;

  for (let i = 0; i < puPhotos.length; i++) {
    const p = puPhotos[i];

    // Advance orbit angle
    p.currentAngle += PU.ORBIT_SPEED * dt * p.orbitDir;

    // Position on elliptical orbit
    const x = Math.cos(p.currentAngle) * p.orbitR
            + Math.sin(time * PU.DRIFT_SPEED + p.driftPhase) * p.driftAmpX;
    const y = Math.sin(p.currentAngle) * p.orbitR * 0.55
            + Math.cos(time * PU.DRIFT_SPEED * 0.7 + p.driftPhase) * p.driftAmpY;

    // Z with gentle oscillation
    const z = p.zBase + Math.sin(time * 0.0003 + p.driftPhase) * 80;

    // Depth-based scale, opacity, blur
    const zNorm  = (z + PU.DEPTH_RANGE) / (PU.DEPTH_RANGE * 2); // 0 (far) → 1 (close)
    const scale  = (0.35 + zNorm * 0.8) * p.sizeVar;
    const alpha  = clamp(0.15 + zNorm * 0.85, 0.08, 1);
    const blur   = clamp((1 - zNorm) * 3.5, 0, 4);

    // If this photo is the featured one, dim it a bit in the cloud
    const isFeat = (i === puFeaturedIdx);
    const finalAlpha = isFeat ? alpha * 0.25 : alpha;

    // Apply transform (translate3d for GPU compositing)
    p.el.style.transform = `translate3d(${x}px, ${y}px, ${z}px) `
                         + `rotateX(${p.tiltX}deg) rotateY(${p.tiltY}deg) `
                         + `scale(${scale})`;
    p.el.style.opacity = finalAlpha;
    p.el.style.filter  = blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : 'none';
    // z-index from depth so closer photos stack on top
    p.el.style.zIndex  = Math.round(zNorm * 100);
  }
}

/* ══════════════════════════════════════════════════════════════
   10d.  FEATURED PHOTO  — periodic zoom-to-front
   ══════════════════════════════════════════════════════════════ */
function puShowFeatured() {
  // Pick a random index different from last
  let idx;
  do { idx = randInt(0, puPhotos.length - 1); } while (idx === puFeaturedIdx && puPhotos.length > 1);
  puFeaturedIdx = idx;

  const p = puPhotos[idx];
  $puFeatImg.src = p.el.src;

  // Activate
  $puFeatFrame.classList.add('is-active');

  // Hide after 2.5s
  setTimeout(() => {
    $puFeatFrame.classList.remove('is-active');
    setTimeout(() => { puFeaturedIdx = -1; }, 500);
  }, 2500);
}

function puStartFeatureLoop() {
  puStopFeatureLoop();
  puFeatureTimer = setInterval(puShowFeatured, PU.FEATURE_INTERVAL_MS);
}

function puStopFeatureLoop() {
  if (puFeatureTimer) { clearInterval(puFeatureTimer); puFeatureTimer = null; }
  puFeaturedIdx = -1;
  $puFeatFrame.classList.remove('is-active');
}

/* ══════════════════════════════════════════════════════════════
   10e.  START / STOP  (controlled by IntersectionObserver)
   ══════════════════════════════════════════════════════════════ */
function puStart() {
  if (puRunning) return;
  puRunning  = true;
  puLastTime = 0;
  puAnimId   = requestAnimationFrame(puAnimate);
  puStartFeatureLoop();
}

function puStop() {
  puRunning = false;
  if (puAnimId) { cancelAnimationFrame(puAnimId); puAnimId = null; }
  puStopFeatureLoop();
}

/* ── IntersectionObserver — start only when visible ────────── */
const puObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) puStart();
    else puStop();
  });
}, { threshold: 0.15 });

puObserver.observe($puSection);

/* ── Init ─────────────────────────────────────────────────── */
puDrawStars();
puInitPool();

/* Re-init photo pool once image probing resolves (update srcs) */
imageProbePromise.then(() => puInitPool());

/* ── Click-to-feature interaction ─────────────────────────── */
$puStage.style.pointerEvents = 'auto';
$puStage.addEventListener('click', (e) => {
  const photo = e.target.closest('.pu-photo');
  if (!photo) return;
  const idx = puPhotos.findIndex(p => p.el === photo);
  if (idx < 0 || idx === puFeaturedIdx) return;
  puFeaturedIdx = idx;
  $puFeatImg.src = photo.src;
  $puFeatFrame.classList.add('is-active');
  setTimeout(() => {
    $puFeatFrame.classList.remove('is-active');
    setTimeout(() => { puFeaturedIdx = -1; }, 500);
  }, 3000);
});

/* Re-init on resize */
window.addEventListener('resize', () => {
  puDrawStars();
});
