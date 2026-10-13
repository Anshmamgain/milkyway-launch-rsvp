// The flow's background. Each RSVP step has its own pattern from the brandbook
// (04 · Patterns): spacetime grid, pulsar, galaxy spiral, aurora field, chromatic
// dispersion. Moving to a step opens the next pattern through an iris. Typing pulses
// the current one; the crew size grows the aurora.

const C = {
  void: '#000621', deep: '#182276', cosmic: '#506CD9', orbit: '#D13F30', nebula: '#F6AAC8',
  kiwi: '#4DAA48', ufo: '#22D974', gold: '#EAD11F', cream: '#FFE3C5', ink: '#0B1450',
};

export function initScene(canvas, { reduced }) {
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
  let W = 0, H = 0, R = 0;
  let mode = 'grid', prev = null, irisT = 1, irisFrom = { x: 0, y: 0 };
  let pulse = 0, level = 0, levelT = 0;
  let mx = 0.5, my = 0.5, tmx = 0.5, tmy = 0.5;
  const ripples = [];
  let stars = [], shards = [], spikes = [];

  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight; R = Math.hypot(W, H) / 2;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    stars = Array.from({ length: Math.round(Math.min(220, (W * H) / 6000)) }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Math.random(), tw: Math.random() * 6.28 }));
    shards = Array.from({ length: 170 }, () => newShard(Math.random()));
    const n = Math.max(26, Math.round(W / 34));
    spikes = Array.from({ length: n }, (_, i) => ({ x: (i + 0.5) / n, h: 0.25 + Math.random() * 0.4, ph: Math.random() * 6.28, sp: 0.6 + Math.random() * 0.9 }));
    if (reduced) draw(performance.now());
  }
  function newShard(f = 1) {
    return { r: (0.15 + f * 1.05), a: Math.random() * 6.28, s: 0.5 + Math.random() * 1.1, rot: Math.random() * 6.28, k: Math.random() };
  }
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => { tmx = e.clientX / W; tmy = e.clientY / H; }, { passive: true });

  /* ---------------- patterns ---------------- */
  const P = {
    grid(t) {
      ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
      drawStars(t, 0.8);
      const gap = Math.max(54, Math.min(W, H) / 11);
      const cx = mx * W, cy = my * H;
      const disp = (x, y) => {
        let dx = Math.sin(y * 0.006 + t * 0.6) * 14 + Math.sin((x + y) * 0.003 + t * 0.35) * 10;
        let dy = Math.cos(x * 0.005 + t * 0.5) * 14;
        // gravity well under the pointer
        const vx = cx - x, vy = cy - y, d2 = vx * vx + vy * vy, g = 5200 / (d2 / 900 + 60);
        dx += vx * g * 0.012 * (1 + pulse); dy += vy * g * 0.012 * (1 + pulse);
        for (const rp of ripples) {
          const d = Math.hypot(x - rp.x, y - rp.y), w = (d - rp.r);
          if (Math.abs(w) < 90) { const f = Math.cos(w / 90 * Math.PI / 2) * 22 * rp.a; dx += (x - rp.x) / (d || 1) * f; dy += (y - rp.y) / (d || 1) * f; }
        }
        return [x + dx, y + dy];
      };
      ctx.strokeStyle = C.nebula; ctx.lineWidth = 2; ctx.globalAlpha = 0.9;
      for (let y = -gap; y < H + gap; y += gap) {
        ctx.beginPath();
        for (let x = -gap; x <= W + gap; x += 24) { const [px, py] = disp(x, y); x === -gap ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
        ctx.stroke();
      }
      for (let x = -gap; x < W + gap; x += gap) {
        ctx.beginPath();
        for (let y = -gap; y <= H + gap; y += 24) { const [px, py] = disp(x, y); y === -gap ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },

    pulsar(t) {
      ctx.fillStyle = C.deep; ctx.fillRect(0, 0, W, H);
      const cx = W * (0.5 + (mx - 0.5) * 0.08), cy = H * (0.5 + (my - 0.5) * 0.08);
      const n = 16, rot = t * 0.06, core = Math.min(W, H) * (0.13 + pulse * 0.06);
      ctx.fillStyle = C.cosmic;
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * Math.PI * 2, w = (Math.PI / n) * 0.55;
        const r1 = core * (1.6 + 0.25 * Math.sin(t * 1.3 + i)), r2 = R * 1.25;
        const pt = (ang, r) => [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
        // a ray with one lightning notch, like the brandbook's pulsar
        const pts = [pt(a - w * 0.6, core * 0.9), pt(a - w * 0.7, r1), pt(a - w * 0.25, r1 * 1.08), pt(a - w * 0.55, r2),
          pt(a + w * 0.55, r2), pt(a + w * 0.2, r1 * 1.25), pt(a + w * 0.65, r1 * 1.18), pt(a + w * 0.6, core * 0.9)];
        ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(cx, cy, core * 1.05, 0, 7); ctx.fill();
    },

    spiral(t, dt) {
      ctx.fillStyle = C.nebula; ctx.fillRect(0, 0, W, H);
      const cx = W * (0.5 + (mx - 0.5) * 0.1), cy = H * (0.5 + (my - 0.5) * 0.1), S = Math.max(W, H) * 0.62;
      ctx.fillStyle = C.cosmic;
      for (const s of shards) {
        s.a += dt * (0.25 + 0.5 / (s.r + 0.2)) * (1 + pulse * 2);
        s.r -= dt * 0.035 * (1 + pulse * 3);
        if (s.r < 0.12) Object.assign(s, newShard(1));
        const x = cx + Math.cos(s.a) * s.r * S, y = cy + Math.sin(s.a) * s.r * S * 0.82;
        const sz = (10 + 46 * s.r) * s.s, dir = s.a + Math.PI / 2 + 0.5;
        ctx.save(); ctx.translate(x, y); ctx.rotate(dir);
        ctx.beginPath(); ctx.moveTo(-sz, -sz * 0.18); ctx.lineTo(sz * 0.9, 0); ctx.lineTo(-sz * 0.6, sz * 0.42); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    },

    aurora(t) {
      ctx.fillStyle = C.orbit; ctx.fillRect(0, 0, W, H);
      levelT += (level - levelT) * 0.06;
      const n = spikes.length, bw = W / n;
      ctx.fillStyle = C.ufo;
      ctx.beginPath(); ctx.moveTo(0, H);
      spikes.forEach((s, i) => {
        const wob = 0.12 * Math.sin(t * s.sp + s.ph) + 0.06 * Math.sin(t * 2.3 + i);
        const h = Math.min(0.96, (s.h + wob) * (0.75 + levelT * 0.16) + pulse * 0.25) * H;
        const x = s.x * W + (mx - 0.5) * 30 * s.h;
        ctx.lineTo(x - bw * 0.5, H); ctx.lineTo(x, H - h); ctx.lineTo(x + bw * 0.5, H);
      });
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      // a solid ground band of green
      ctx.fillRect(0, H * 0.9, W, H * 0.1 + 2);
    },

    chroma(t) {
      ctx.fillStyle = C.kiwi; ctx.fillRect(0, 0, W, H);
      const vx = -W * 0.12, vy = H * (0.5 + (my - 0.5) * 0.15);
      const n = 11, L = W * 1.3;
      ctx.fillStyle = C.gold;
      for (let i = 0; i < n; i++) {
        const a0 = -0.62 + (i / n) * 1.24, a1 = a0 + (1.24 / n) * 0.52;
        const step = 140, off = (t * 160 * (1 + pulse * 3) + i * 47) % step;
        const top = [], bot = [];
        for (let d = 60 - off; d < L; d += step) {
          const k = Math.max(60, d), jog = 0.018 * (i % 2 ? 1 : -1);
          top.push([vx + Math.cos(a0) * k, vy + Math.sin(a0) * k], [vx + Math.cos(a0 + jog) * (k + step * 0.5), vy + Math.sin(a0 + jog) * (k + step * 0.5)]);
          bot.push([vx + Math.cos(a1) * k, vy + Math.sin(a1) * k], [vx + Math.cos(a1 + jog) * (k + step * 0.5), vy + Math.sin(a1 + jog) * (k + step * 0.5)]);
        }
        ctx.beginPath(); ctx.moveTo(vx, vy);
        top.forEach(([x, y]) => ctx.lineTo(x, y));
        bot.reverse().forEach(([x, y]) => ctx.lineTo(x, y));
        ctx.closePath(); ctx.fill();
      }
    },

    ticket(t) {
      ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
      const cx = W / 2, cy = H * 0.45, n = 18, rot = t * 0.03;
      ctx.fillStyle = C.ink;
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * Math.PI * 2, w = (Math.PI / n) * 0.5;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a - w) * R * 1.4, cy + Math.sin(a - w) * R * 1.4);
        ctx.lineTo(cx + Math.cos(a + w) * R * 1.4, cy + Math.sin(a + w) * R * 1.4);
        ctx.closePath(); ctx.fill();
      }
      drawStars(t, 1);
    },
  };

  function drawStars(t, a) {
    for (const s of stars) {
      ctx.globalAlpha = a * (0.25 + 0.75 * Math.abs(Math.sin(t * 0.8 + s.tw))) * (0.4 + s.z * 0.6);
      ctx.fillStyle = s.z > 0.85 ? C.cream : '#FFFFFF';
      const x = (s.x + (mx - 0.5) * 30 * s.z + W) % W, y = (s.y + (my - 0.5) * 20 * s.z + H) % H;
      ctx.beginPath(); ctx.arc(x, y, 0.6 + s.z * 1.3, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- loop ---------------- */
  let last = performance.now();
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  function draw(now) {
    const t = now / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    pulse *= 0.93;
    for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.r += dt * 520; r.a *= 0.975; if (r.a < 0.03) ripples.splice(i, 1); }
    if (prev && irisT < 1) {
      irisT = Math.min(1, irisT + dt / 0.95);
      P[prev](t, dt);
      ctx.save(); ctx.beginPath(); ctx.arc(irisFrom.x, irisFrom.y, ease(irisT) * R * 2.2 + 1, 0, 7); ctx.clip();
      P[mode](t, dt); ctx.restore();
      if (irisT >= 1) prev = null;
    } else P[mode](t, dt);
  }
  function loop(now) { draw(now); requestAnimationFrame(loop); }

  document.documentElement.dataset.mode = mode;
  resize();
  if (!reduced) requestAnimationFrame(loop);

  return {
    setMode(next, from) {
      if (next === mode || !P[next]) return;
      prev = mode; mode = next; irisT = reduced ? 1 : 0;
      document.documentElement.dataset.mode = next;
      irisFrom = from || { x: W / 2, y: H / 2 };
      if (reduced) { prev = null; draw(performance.now()); }
    },
    pulse(v = 0.6, at) {
      pulse = Math.min(1.4, pulse + v);
      if (mode === 'grid') ripples.push({ x: at?.x ?? W / 2, y: at?.y ?? H / 2, r: 0, a: 1 });
    },
    setLevel(v) { level = v; },
    get mode() { return mode; },
  };
}
