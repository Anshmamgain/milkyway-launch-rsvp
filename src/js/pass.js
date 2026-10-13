import qrcode from 'qrcode-generator';
import { SVG } from './svg.js';
import { qrPayload } from './rsvp.js';

// The saved ticket: a 1080 × 1920 story-sized image drawn on canvas with the brand's own
// fonts, symbols, mascot and the same check-in QR code as the on-screen ticket.
const C = { void: '#000621', deep: '#182276', cosmic: '#506CD9', orbit: '#D13F30', nebula: '#F6AAC8', gold: '#EAD11F', moon: '#F7F7F5', ufo: '#22D974' };
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const svgImg = (name, color) => {
  let raw = SVG[name];
  if (color) raw = raw.replace(/currentColor/g, color);
  return loadImg(URL.createObjectURL(new Blob([raw], { type: 'image/svg+xml' })));
};
function font(ctx, w, size, cond = true) {
  ctx.font = `${w} ${cond ? 'condensed ' : ''}${size}px ${cond ? '"Bricolage Grotesque", "Arial Narrow"' : '"Mozilla Headline", "Helvetica Neue"'}, sans-serif`;
  if ('fontStretch' in ctx) ctx.fontStretch = cond ? 'condensed' : 'normal';
}
function fit(ctx, text, maxW, start, min = 40) { let s = start; do { font(ctx, 800, s); s -= 4; } while (ctx.measureText(text).width > maxW && s > min); }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

export async function renderPassPng(d) {
  await Promise.all([document.fonts.load('800 condensed 80px "Bricolage Grotesque"'), document.fonts.load('600 30px "Mozilla Headline"')]).catch(() => {});
  const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const base = cv.getContext('2d');
  let ctx = base;
  const wait = d.status === 'waitlist';

  // ground: void with deep-blue pulsar rays and stars
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, 760); ctx.fillStyle = '#0B1450';
  for (let i = 0; i < 18; i++) { ctx.rotate(Math.PI * 2 / 18); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1800, -150); ctx.lineTo(1800, 150); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  for (let i = 0; i < 160; i++) { ctx.globalAlpha = Math.random() * 0.8 + 0.2; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2.2 + 0.4, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;

  const [mu, logo3d, mascot] = await Promise.all([svgImg('mu-logo', '#FFFFFF'), svgImg('logo3d'), loadImg('assets/img/pose3.webp')]);
  ctx.drawImage(mu, 80, 90, 230, 230 * (mu.height / mu.width));

  // the ticket is drawn on its own layer so its notches can be cut out cleanly
  const layer = document.createElement('canvas'); layer.width = W; layer.height = H;
  ctx = layer.getContext('2d');

  // ticket geometry
  const x = 140, w = W - 280, top = 300, headH = 520, bodyH = 470, tearY = top + headH + bodyH, stubH = 300, r = 48;

  // head: cosmic with orbit-red rays
  ctx.save(); rr(ctx, x, top, w, headH, [r, r, 0, 0]); ctx.clip();
  ctx.fillStyle = wait ? C.deep : C.cosmic; ctx.fillRect(x, top, w, headH);
  ctx.save(); ctx.translate(x + w / 2, top + headH * 0.62); ctx.fillStyle = C.orbit; ctx.globalAlpha = wait ? 0.35 : 1;
  for (let i = 0; i < 16; i++) { ctx.rotate(Math.PI * 2 / 16); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1000, -110); ctx.lineTo(1000, 110); ctx.closePath(); ctx.fill(); }
  ctx.restore(); ctx.globalAlpha = 1;
  const lw = w * 0.64; ctx.drawImage(logo3d, x + (w - lw) / 2, top + 120, lw, lw * (logo3d.height / logo3d.width));
  ctx.restore();
  // status pill
  const status = wait ? `WAITLIST${d.position ? ` #${d.position}` : ''}` : `ADMIT ${d.seats}`;
  font(ctx, 800, 34); const sw = ctx.measureText(status).width + 48;
  ctx.fillStyle = C.void; rr(ctx, x + 40, top + 38, sw + 6, 64, 32); ctx.fill();
  ctx.fillStyle = wait ? C.nebula : C.gold; rr(ctx, x + 43, top + 41, sw, 58, 29); ctx.fill();
  ctx.fillStyle = C.void; ctx.textAlign = 'center'; ctx.fillText(status, x + 43 + sw / 2, top + 82);
  // "THE LAUNCH" tag
  ctx.save(); ctx.translate(x + w / 2, top + headH - 62); ctx.rotate(-0.035);
  font(ctx, 800, 40); const tw = ctx.measureText('T H E   L A U N C H').width + 50;
  ctx.fillStyle = C.void; ctx.fillRect(-tw / 2, -36, tw, 62); ctx.fillStyle = '#fff'; ctx.fillText('T H E   L A U N C H', 0, 10); ctx.restore();
  ctx.textAlign = 'left';

  // body
  ctx.fillStyle = C.moon; ctx.fillRect(x, top + headH, w, bodyH);
  const bx = x + 56; let y = top + headH + 70;
  const lab = (t, lx, ly) => { font(ctx, 800, 24); ctx.fillStyle = 'rgba(0,6,33,0.5)'; ctx.fillText(t.split('').join(String.fromCharCode(8202)), lx, ly); };
  lab('PASSENGER', bx, y);
  ctx.fillStyle = C.void; fit(ctx, d.name.toUpperCase(), w - 112, 104); ctx.fillText(d.name.toUpperCase(), bx, y + 96);
  font(ctx, 500, 30, false); ctx.fillStyle = 'rgba(0,6,33,0.7)';
  ctx.fillText(`${d.batch.replace('UG ', 'UG · ')}${d.crew ? ` · with ${d.crew} friend${d.crew > 1 ? 's' : ''}` : ''}`, bx, y + 146);
  y += 220;
  [['DATE', 'FRI 16 OCT'], ['DOORS', '2:45 PM'], ['VENUE', 'AUDITORIUM · 8F'], ['SEATS', String(d.seats)]].forEach(([k, v], i) => {
    const cx = bx + (i % 2) * ((w - 112) / 2), cy = y + Math.floor(i / 2) * 104;
    lab(k, cx, cy); font(ctx, 800, 46); ctx.fillStyle = C.void; ctx.fillText(v, cx, cy + 52);
  });

  // tear line with notches
  ctx.fillStyle = C.moon; ctx.fillRect(x, tearY, w, 60);
  ctx.strokeStyle = 'rgba(0,6,33,0.3)'; ctx.lineWidth = 4; ctx.setLineDash([16, 14]);
  ctx.beginPath(); ctx.moveTo(x + 46, tearY + 30); ctx.lineTo(x + w - 46, tearY + 30); ctx.stroke(); ctx.setLineDash([]);

  // stub with QR
  const sy = tearY + 60;
  ctx.fillStyle = C.moon; rr(ctx, x, sy, w, stubH, [0, 0, r, r]); ctx.fill();
  const q = qrcode(0, 'M'); q.addData(qrPayload(d)); q.make();
  const n = q.getModuleCount(), qs = 220, cell = qs / n, qx = bx, qy = sy + 22;
  ctx.fillStyle = '#fff'; rr(ctx, qx - 12, qy - 12, qs + 24, qs + 24, 16); ctx.fill();
  ctx.fillStyle = wait ? 'rgba(0,6,33,0.25)' : C.void;
  for (let rI = 0; rI < n; rI++) for (let c = 0; c < n; c++) if (q.isDark(rI, c)) ctx.fillRect(qx + c * cell, qy + rI * cell, Math.ceil(cell), Math.ceil(cell));
  const tx = qx + qs + 50;
  font(ctx, 800, 64); ctx.fillStyle = C.void; ctx.fillText(d.ticketId, tx, sy + 100);
  font(ctx, 500, 28, false); ctx.fillStyle = 'rgba(0,6,33,0.7)';
  ctx.fillText(wait ? "Not a ticket yet. We'll message" : 'Show this at the door.', tx, sy + 150);
  if (wait) ctx.fillText('you if a seat opens.', tx, sy + 188);
  font(ctx, 800, 26); ctx.fillStyle = C.deep; ctx.fillText('FRI 16 OCT · 2:45 – 9:30 PM', tx, sy + 236);

  ctx.save(); ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.arc(x, tearY + 30, 28, 0, 7); ctx.arc(x + w, tearY + 30, 28, 0, 7); ctx.fill(); ctx.restore();
  ctx = base;
  ctx.drawImage(layer, 0, 0);

  // the mascot leaning over the top-right corner
  const mh = 330; ctx.drawImage(mascot, x + w - 190, top - 150, mh * (mascot.width / mascot.height), mh);

  font(ctx, 800, 40); ctx.fillStyle = C.gold; ctx.textAlign = 'center';
  ctx.fillText('SEE YOU AT THE LAUNCH', W / 2, H - 150);
  font(ctx, 500, 28, false); ctx.fillStyle = 'rgba(247,247,245,0.7)';
  ctx.fillText('Auditorium, 8th Floor, CDS Tower · Masters’ Union', W / 2, H - 100);
  return cv.toDataURL('image/png');
}
