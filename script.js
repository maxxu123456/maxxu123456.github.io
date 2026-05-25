(() => {
  "use strict";

  /* ---------- Clock ---------- */
  const clockEl = document.getElementById("clock");
  const yearEl = document.getElementById("year");

  const TZ = "America/Chicago";
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
     A registry of physics/science-themed scalar fields. Each function maps
     (x, y, t, cols, rows) -> a value in [0, 1] which becomes a character on
     the halftone ramp. One animation is picked at random on page load. */
  const asciiEl = document.getElementById("ascii");
  if (!asciiEl) return;

  const RAMP = " .,:;-=+*o#%@";
  const CELL_W = 5;
  const CELL_H = 9;
  // Aspect correction: cells are ~5×9 px, so y-distances need scaling to
  // look round in physical pixels.
  const AY = CELL_H / CELL_W; // ≈ 1.8

  let cols = 0, rows = 0, t = 0;

  function resize() {
    cols = Math.max(40, Math.floor(window.innerWidth / CELL_W));
    rows = Math.max(20, Math.floor(window.innerHeight / CELL_H));
  }
  resize();
  window.addEventListener("resize", resize);

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

  // 6. Vortex — fluid rotating around a moving eye (Kármán-style).
  function vortex(x, y, t, cols, rows) {
    const cx = cols / 2 + Math.cos(t * 0.3) * cols * 0.08;
    const cy = rows / 2 + Math.sin(t * 0.4) * rows * 0.08;
    const dx = x - cx;
    const dy = (y - cy) * AY;
    const r = Math.hypot(dx, dy) + 1;
    const theta = Math.atan2(dy, dx);
    // Tangential phase + radial wavelength — concentric rotating arms.
    const phase = theta * 3 + r * 0.18 - t * 1.2;
    const wave = Math.sin(phase);
    const decay = 1 - Math.min(1, r * 0.015);
    return (wave * (0.5 + decay * 0.5) + 1) / 2;
  }

  /* ---------- Registry ---------- */
  const ANIMATIONS = {
    flow,    // diagonal flowing field
    galaxy,  // log-spiral arms
    dipole,  // magnetic field lines
    plasma,  // turbulent EM field
    vortex,  // rotating fluid
  };

  // Pick animation: ?anim=name in URL wins, else random.
  function pickAnimation() {
    const q = new URLSearchParams(location.search).get("anim");
    if (q && ANIMATIONS[q]) return [q, ANIMATIONS[q]];
    const keys = Object.keys(ANIMATIONS);
    const k = keys[Math.floor(Math.random() * keys.length)];
    return [k, ANIMATIONS[k]];
  }

  const [animName, animFn] = pickAnimation();
  console.log(`[ascii] animation: ${animName}  (try ?anim=<name>)`);
  console.log(`[ascii] available: ${Object.keys(ANIMATIONS).join(", ")}`);

  function frame() {
    t += 0.012;
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
