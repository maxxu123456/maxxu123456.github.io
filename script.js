(() => {
  "use strict";

  /* ---------- Clock ---------- */
  const clockEl = document.getElementById("clock");
  const yearEl = document.getElementById("year");

  const TZ = "America/Denver";
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: true,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const offsetFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    timeZoneName: "shortOffset",
  });
  const nameFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    timeZoneName: "short",
  });

  function tick() {
    if (!clockEl) return;
    const now = new Date();
    const time = timeFmt.format(now);
    const offsetPart = offsetFmt
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value;
    const offset = offsetPart.replace(/^GMT/, "UTC");
    const name = nameFmt
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value;
    clockEl.textContent = `${time} · ${offset} ${name}`;
  }
  tick();
  setInterval(tick, 1000);
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- ASCII background ----------
     Picks one scalar field at random on load and renders it as a halftone
     ASCII grid. Each animation maps (x, y, t, cols, rows) -> [0, 1]. */
  const asciiEl = document.getElementById("ascii");
  if (!asciiEl) return;

  const RAMP = " .,:;-=+*o#%@";

  // Cell size is measured from a sample span so the grid matches whatever
  // font-size/line-height the CSS applies (mobile vs desktop differ).
  let CELL_W = 5, CELL_H = 9, AY = 1.8;
  function measureCell() {
    const sample = document.createElement("span");
    sample.style.cssText =
      "visibility:hidden;white-space:pre;position:absolute;font:inherit;";
    sample.textContent = "0\n0\n0\n0\n0\n0\n0\n0\n0\n0";
    asciiEl.appendChild(sample);
    const r = sample.getBoundingClientRect();
    asciiEl.removeChild(sample);
    if (r.width > 0 && r.height > 0) {
      CELL_W = r.width;
      CELL_H = r.height / 10;
      AY = CELL_H / CELL_W;
    }
  }

  let cols = 0, rows = 0, t = 0;

  function resize() {
    measureCell();
    const paneRect = asciiEl.parentElement.getBoundingClientRect();
    const w = paneRect.width || window.innerWidth;
    const h = paneRect.height || window.innerHeight;
    cols = Math.max(40, Math.ceil(w / CELL_W) + 1);
    rows = Math.max(20, Math.ceil(h / CELL_H) + 1);
  }
  resize();

  // Debounce so iOS Safari's address-bar collapse (which fires a small
  // height-only resize) doesn't recompute the grid mid-scroll.
  let resizeT = null;
  let lastW = window.innerWidth;
  window.addEventListener("resize", () => {
    const w = window.innerWidth;
    if (Math.abs(w - lastW) < 2) return; // ignore height-only changes
    lastW = w;
    clearTimeout(resizeT);
    resizeT = setTimeout(resize, 180);
  });

  /* ===================================================================
   * Animations. Each returns a value in roughly [0, 1].
   * =================================================================== */

  // 1. Flow — diagonal undulating bands (aurora / magnetic field drift).
  function flow(x, y, t) {
    const u = (x - y * 0.9) * 0.045 + t * 0.35;
    const v = (x + y) * 0.012;
    const curve = Math.sin(v + t * 0.12) * 1.6;
    const wave = Math.sin(u + curve);
    const slow = Math.sin(u * 0.28 - t * 0.18) * 0.55;
    return (wave + slow + 1.55) / 3.1;
  }

  // 2. Galaxy — logarithmic spiral arms rotating about the center.
  function galaxy(x, y, t, cols, rows) {
    const dx = x - cols / 2;
    const dy = (y - rows / 2) * AY;
    const r = Math.hypot(dx, dy) + 1;
    const theta = Math.atan2(dy, dx);
    const arms = 2;
    const tightness = 1.4;
    const arm = Math.cos(arms * theta - Math.log(r) * tightness * 2 + t * 0.5);
    const halo = Math.cos(r * 0.05 - t * 0.3) * 0.35;
    return (arm + halo + 1.35) / 2.7;
  }

  // 4. Dipole — magnetic field topology, bands tracing the field lines that
  // loop from the north pole (top) to the south pole (bottom). The stream
  // function ψ ∝ sin²θ / r is constant along each field line, so cos(ψ)
  // outlines them. We square-root and scale so the bands are roughly evenly
  // spaced instead of collapsing to a dot near the origin.
  function dipole(x, y, t, cols, rows) {
    const dx = (x - cols / 2);
    const dy = (y - rows / 2) * AY;
    const r = Math.hypot(dx, dy);
    if (r < 1) return 0; // small "magnet" core
    const theta = Math.atan2(dy, dx);
    const psi = (Math.sin(theta) * Math.sin(theta)) * 120 / r;
    const bands = Math.cos(Math.sqrt(psi) * 3.5 - t * 0.9);
    return Math.tanh(bands * 1.5) * 0.5 + 0.5;
  }

  // 5. Plasma — multi-octave turbulent field (Perlin-ish without the table).
  function plasma(x, y, t, cols, rows) {
    const cx = cols / 2, cy = rows / 2;
    const ox = Math.cos(t * 0.4) * 12;
    const oy = Math.sin(t * 0.6) * 12;
    const v1 = Math.sin(x * 0.09 + t * 0.7);
    const v2 = Math.sin(y * 0.075 * AY + Math.sin(t * 0.5) * 2.2);
    const v3 = Math.sin((x + y * AY) * 0.05 + t * 0.3);
    const v4 = Math.sin(Math.hypot(x - cx + ox, (y - cy) * AY + oy) * 0.1 + t);
    return (v1 + v2 + v3 + v4 + 4) / 8;
  }

  /* ---------- Registry ---------- */
  const ANIMATIONS = {
    flow,    // diagonal flowing field
    galaxy,  // log-spiral arms
    dipole,  // magnetic field lines
    plasma,  // turbulent EM field
  };

  // Pick animation: ?anim=name in URL wins, else random.
  function pickInitial() {
    const q = new URLSearchParams(location.search).get("anim");
    if (q && ANIMATIONS[q]) return q;
    const keys = Object.keys(ANIMATIONS);
    return keys[Math.floor(Math.random() * keys.length)];
  }

  let currentName = pickInitial();
  console.log(
    `[ascii] animation: ${currentName}  (available: ${Object.keys(ANIMATIONS).join(", ")})`
  );

  /* ---------- Tab bar ---------- */
  const tabsEl = document.getElementById("anim-tabs");
  function setAnim(name) {
    if (!ANIMATIONS[name]) return;
    currentName = name;
    if (!tabsEl) return;
    for (const btn of tabsEl.querySelectorAll("button")) {
      btn.classList.toggle("active", btn.dataset.anim === name);
    }
  }
  if (tabsEl) {
    for (const name of Object.keys(ANIMATIONS)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = name;
      btn.dataset.anim = name;
      btn.addEventListener("click", () => setAnim(name));
      tabsEl.appendChild(btn);
    }
    setAnim(currentName);
  }

  function frame() {
    t += 0.012;
    const animFn = ANIMATIONS[currentName];
    let out = "";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = animFn(x, y, t, cols, rows);
        const i = Math.min(
          RAMP.length - 1,
          Math.max(0, Math.floor(v * RAMP.length))
        );
        out += RAMP[i];
      }
      out += "\n";
    }
    asciiEl.textContent = out;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
