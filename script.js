(() => {
  'use strict';

  /* ---------- Clock ---------- */
  const clockEl = document.getElementById('clock');
  const yearEl = document.getElementById('year');

  const TZ = 'America/Chicago';
  const timeFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hour12: true,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const offsetFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, timeZoneName: 'shortOffset',
  });

  function tick() {
    if (!clockEl) return;
    const now = new Date();
    const time = timeFmt.format(now);
    const offsetPart = offsetFmt.formatToParts(now)
      .find(p => p.type === 'timeZoneName')?.value || 'GMT-06';
    const offset = offsetPart.replace(/^GMT/, 'UTC');
    clockEl.textContent = `${time} · ${offset}`;
  }
  tick();
  setInterval(tick, 1000);
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- ASCII background ----------
     Fills the viewport with a soft, slowly-drifting noise pattern rendered
     as ASCII characters. Pure 2D math — no canvas, no WebGL. */
  const asciiEl = document.getElementById('ascii');
  if (!asciiEl) return;

  // Halftone ramp — symbols only, light to dark.
  const RAMP = ' .,:;-=+*o#%@';
  const CELL_W = 5;   // px per character horizontally
  const CELL_H = 9;   // px per character vertically (matches CSS line-height)

  let cols = 0, rows = 0;
  let t = 0;

  function resize() {
    cols = Math.max(40, Math.floor(window.innerWidth / CELL_W));
    rows = Math.max(20, Math.floor(window.innerHeight / CELL_H));
  }
  resize();
  window.addEventListener('resize', resize);

  // Diagonal flowing bands: project onto a NE/SW axis, add a slow perpendicular
  // curvature so the bands undulate instead of running perfectly straight,
  // and layer in a slower wave to create thicker/thinner bands over time.
  function noise(x, y, time) {
    const u = (x - y * 0.9) * 0.045 + time * 0.35;            // primary axis
    const v = (x + y) * 0.012;                                // perpendicular
    const curve = Math.sin(v + time * 0.12) * 1.6;            // gentle bend
    const wave  = Math.sin(u + curve);
    const slow  = Math.sin(u * 0.28 - time * 0.18) * 0.55;    // band thickness
    return (wave + slow + 1.55) / 3.1;                        // 0..1
  }

  function frame() {
    t += 0.012;
    let out = '';
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = noise(x, y, t);
        const i = Math.min(RAMP.length - 1, Math.max(0, Math.floor(v * RAMP.length)));
        out += RAMP[i];
      }
      out += '\n';
    }
    asciiEl.textContent = out;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
