import gsap from 'gsap';
import qrcode from 'qrcode-generator';
import { SVG } from './svg.js';
import { API, APPS_SCRIPT, DEMO, MAX_CREW, EVENT, EMAIL_DOMAIN } from '../config.js';
import { downloadIcs } from './ics.js';
import { renderPassPng } from './pass.js';
import { seats } from './seats.js';

const STORE = 'mw-launch-rsvp';
const WORLD_SYM = { Imagine: 'sym-imagine', Explore: 'sym-explore', Create: 'sym-create', Connect: 'sym-connect' };
const CREW_LINES = [
  "Just you. That's one seat.",
  'You and a co-pilot. Two seats.',
  'Three in the capsule.',
  'Four seats. That is a proper crew.',
  'Five seats. The auditorium will feel it.',
];

const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
export const ticketIdFor = (email) => `MW-${(hash(email.toLowerCase()) % 60466176).toString(36).toUpperCase().padStart(5, '0')}`;
export const qrPayload = (d) => `MWLAUNCH26|${d.ticketId}|${d.email}|${d.seats}`;

export function readSaved() {
  try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch { return null; }
}
function save(d) { try { localStorage.setItem(STORE, JSON.stringify(d)); } catch { /* private mode: the ticket still shows */ } }

export function initRsvp({ reduced, scene, toast }) {
  const form = document.getElementById('rsvpForm');
  const steps = [...form.querySelectorAll('.step')];
  const dots = [...form.querySelectorAll('.progress li')];
  const back = document.getElementById('back');
  const next = document.getElementById('next');
  const hint = document.getElementById('hint');
  const launch = document.getElementById('launch');
  const ring = launch.querySelector('circle');
  const label = launch.querySelector('.launch__label');
  const waitBanner = document.getElementById('waitBanner');
  const mascot = document.getElementById('mascot');
  const done = document.getElementById('done');
  const ticket = document.getElementById('ticket');
  const crewN = document.getElementById('crewN');
  const crewSay = document.getElementById('crewSay');
  const crewNames = document.getElementById('crewNames');
  const plus = form.querySelector('[data-crew="1"]');

  let step = 0, crew = 0, busy = false;
  let data = readSaved();

  /* ---------------- seats ---------------- */
  const ownSeats = () => (data && data.status === 'confirmed' ? data.seats : 0);
  const seatsFree = () => seats.get().left + ownSeats();
  const waitMode = () => seatsFree() <= 0;
  const maxCrew = () => (waitMode() ? MAX_CREW : Math.max(0, Math.min(MAX_CREW, seatsFree() - 1)));
  function paintMode() {
    waitBanner.hidden = !waitMode();
    label.textContent = waitMode() ? 'Hold to join waitlist' : 'Hold to launch';
    if (crew > maxCrew()) setCrew(maxCrew(), false);
    plus.disabled = crew >= maxCrew();
  }

  /* ---------------- steps ---------------- */
  function splitQ(el) {
    if (!el.dataset.split) {
      el.dataset.split = '1';
      const walk = (node) => [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((w) => {
            if (!w) return;
            if (/^\s+$/.test(w)) frag.appendChild(document.createTextNode(w));
            else { const s = document.createElement('span'); s.className = 'w'; s.textContent = w; frag.appendChild(s); }
          });
          n.replaceWith(frag);
        } else walk(n);
      });
      walk(el);
    }
    return el.querySelectorAll('.w');
  }

  const centerOf = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

  function go(i, instant = false) {
    const prev = steps[step], to = steps[i], dir = i >= step ? 1 : -1;
    step = i;
    const last = i === steps.length - 1;
    back.style.visibility = i === 0 ? 'hidden' : 'visible';
    next.hidden = last; launch.hidden = !last;
    hint.innerHTML = last ? 'Press and hold, or hold <kbd>Space</kbd>' : 'Press <kbd>Enter</kbd> ↵';
    dots.forEach((d, k) => { d.classList.toggle('is-on', k <= i); d.classList.toggle('is-now', k === i); });
    scene.setMode(to.dataset.mode, centerOf(form));
    scene.setLevel(crew);

    const show = () => {
      steps.forEach((s) => s.classList.toggle('is-active', s === to));
      if (!instant && !reduced) {
        gsap.fromTo(splitQ(to.querySelector('.step__q')), { yPercent: 110 * dir, opacity: 0, rotate: 5 * dir }, { yPercent: 0, opacity: 1, rotate: 0, duration: 0.65, ease: 'expo.out', stagger: 0.035 });
        gsap.fromTo(to.querySelectorAll('.field, .chip, .pick__w, .crew, .crew__names'), { y: 26 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: 'power3.out', stagger: 0.05, delay: 0.12 });
        if (last) gsap.fromTo(launch, { scale: 0, rotate: -120 }, { scale: 1, rotate: 0, duration: 0.8, ease: 'back.out(1.7)', delay: 0.15 });
      }
      setTimeout(() => to.querySelector('input:not([type=radio]):not([type=checkbox])')?.focus({ preventScroll: true }), instant || reduced ? 0 : 320);
    };
    if (prev !== to && !instant && !reduced) {
      gsap.to(prev.querySelectorAll('.step__q, .field, .chip, .pick__w, .crew, .crew__names'), {
        y: -26 * dir, opacity: 0, duration: 0.2, ease: 'power2.in', stagger: 0.015,
        onComplete: () => { gsap.set(prev.querySelectorAll('*'), { clearProps: 'opacity,transform' }); show(); },
      });
    } else show();
    swapMascot(to.dataset.pose, instant);
  }

  function swapMascot(pose, instant) {
    const src = `assets/img/${pose}.webp`;
    if (mascot.getAttribute('src') === src) return;
    if (instant || reduced) { mascot.src = src; return; }
    gsap.timeline()
      .to(mascot, { y: 60, rotate: 18, opacity: 0, duration: 0.22, ease: 'power2.in' })
      .add(() => { mascot.src = src; })
      .fromTo(mascot, { y: -80, rotate: -16 }, { y: 0, rotate: 0, opacity: 1, duration: 0.8, ease: 'back.out(1.6)' });
  }

  /* ---------------- validation ---------------- */
  const val = (n) => (form.elements[n]?.value || '').trim();
  const emailInput = form.elements.email;
  // paste a full MU address and we keep only the part before the @
  emailInput.addEventListener('input', () => {
    const v = emailInput.value;
    if (v.toLowerCase().endsWith(`@${EMAIL_DOMAIN}`)) emailInput.value = v.slice(0, -EMAIL_DOMAIN.length - 1);
  });
  const fullEmail = () => `${val('email').toLowerCase()}@${EMAIL_DOMAIN}`;

  function validate(i) {
    const s = steps[i];
    s.classList.remove('has-err');
    s.querySelectorAll('.is-bad').forEach((x) => x.classList.remove('is-bad'));
    let ok = true, msg = null;
    const bad = (input) => { ok = false; input?.classList.add('is-bad'); };
    if (i === 0 && val('name').length < 2) bad(form.elements.name);
    if (i === 1) {
      const local = val('email');
      if (local.includes('@')) { bad(emailInput); msg = `Only @${EMAIL_DOMAIN} emails can RSVP. Type the part before the @.`; }
      else if (!/^[a-z0-9._%+-]{2,}$/i.test(local)) { bad(emailInput); msg = `Type the part of your MU email before @${EMAIL_DOMAIN}.`; }
      if (val('phone').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').length !== 10) { bad(form.elements.phone); msg = msg || 'Phone numbers need 10 digits.'; }
      document.getElementById('contactErr').textContent = msg || `Use your @${EMAIL_DOMAIN} email and a 10-digit phone number.`;
    }
    if (i === 2 && !form.querySelector('input[name=batch]:checked')) ok = false;
    if (!ok) {
      s.classList.add('has-err');
      if (!reduced) gsap.fromTo(form, { x: -12 }, { x: 0, duration: 0.55, ease: 'elastic.out(1, 0.3)' });
      s.querySelector('.is-bad')?.focus({ preventScroll: true });
    }
    return ok;
  }
  next.addEventListener('click', () => { if (validate(step)) go(step + 1); });
  back.addEventListener('click', () => go(Math.max(0, step - 1)));
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && step < steps.length - 1) { e.preventDefault(); if (validate(step)) go(step + 1); }
  });
  form.addEventListener('input', (e) => { if (e.target.matches('input:not([type=radio]):not([type=checkbox])')) scene.pulse(0.18, centerOf(e.target)); });
  form.querySelectorAll('input[name=batch]').forEach((r) => r.addEventListener('change', () => {
    scene.pulse(0.9);
    if (!reduced) gsap.fromTo(r.nextElementSibling, { scale: 0.9 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
    setTimeout(() => { if (step === 2) go(3); }, 420); // the tap is the answer
  }));
  form.querySelectorAll('input[name=worlds]').forEach((r) => r.addEventListener('change', () => {
    scene.pulse(0.7);
    if (r.checked && !reduced) gsap.fromTo(r.nextElementSibling.querySelector('i'), { rotate: -180, scale: 0.4 }, { rotate: 0, scale: 1, duration: 0.6, ease: 'back.out(2)' });
  }));

  /* ---------------- crew ---------------- */
  function setCrew(n, anim = true) {
    crew = gsap.utils.clamp(0, maxCrew(), n);
    crewN.textContent = crew;
    plus.disabled = crew >= maxCrew();
    crewSay.textContent = !waitMode() && crew >= maxCrew() && maxCrew() < MAX_CREW
      ? `Only ${seatsFree()} seat${seatsFree() === 1 ? '' : 's'} left, so that's the biggest crew we can hold.`
      : CREW_LINES[crew];
    scene.setLevel(crew);
    if (anim) { scene.pulse(0.5); if (!reduced) gsap.fromTo(crewN, { scale: 1.5, rotate: -10 }, { scale: 1, rotate: 0, duration: 0.55, ease: 'back.out(3)' }); }
    for (let i = crewNames.children.length; i < crew; i++) {
      const l = document.createElement('label'); l.className = 'field field--sm';
      l.innerHTML = `<span class="field__lab">Friend ${i + 1} (optional)</span><input id="f-friend${i + 1}" name="friend${i + 1}" maxlength="40" placeholder="Their name" />`;
      crewNames.appendChild(l);
      if (anim && !reduced) gsap.from(l, { y: 16, opacity: 0, duration: 0.4, ease: 'power3.out' });
    }
    while (crewNames.children.length > crew) crewNames.lastElementChild.remove();
  }
  form.querySelectorAll('[data-crew]').forEach((b) => b.addEventListener('click', () => setCrew(crew + Number(b.dataset.crew))));

  /* ---------------- hold to launch ---------------- */
  const HOLD = 1.1, LEN = 340, prog = { v: 0 };
  let tween = null;
  const paintRing = () => { ring.style.strokeDashoffset = String(LEN * (1 - prog.v)); };
  function startHold(e) {
    if (busy) return;
    e?.preventDefault?.();
    launch.classList.add('is-holding');
    tween?.kill();
    tween = gsap.to(prog, {
      v: 1, duration: HOLD * (1 - prog.v), ease: 'none', onComplete: fire,
      onUpdate: () => { paintRing(); scene.pulse(0.03); if (!reduced) gsap.set(form, { x: (Math.random() - 0.5) * 5 * prog.v, y: (Math.random() - 0.5) * 5 * prog.v }); },
    });
  }
  function endHold() {
    if (busy || !tween) return;
    launch.classList.remove('is-holding');
    tween.kill();
    tween = gsap.to(prog, { v: 0, duration: 0.35, ease: 'power2.out', onUpdate: paintRing });
    gsap.to(form, { x: 0, y: 0, duration: 0.3 });
  }
  launch.addEventListener('pointerdown', startHold);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => launch.addEventListener(ev, endHold));
  launch.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) startHold(e); });
  launch.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') endHold(); });
  launch.addEventListener('contextmenu', (e) => e.preventDefault());

  function collect() {
    const email = fullEmail();
    return {
      ticketId: ticketIdFor(email), name: val('name'), email, phone: val('phone'),
      batch: form.querySelector('input[name=batch]:checked')?.value || '',
      crew, seats: 1 + crew, friends: Array.from({ length: crew }, (_, i) => val(`friend${i + 1}`)).filter(Boolean),
      worlds: [...form.querySelectorAll('input[name=worlds]:checked')].map((x) => x.value), wish: val('wish'),
      submittedAt: new Date().toISOString(), page: location.href,
    };
  }

  // The server decides: confirmed, waitlist, or too_many (fewer seats left than the crew needs).
  // Busy or flaky moments (429, 5xx, dropped connections) are retried with backoff; the same email
  // always books the same seats, so a retry can never double-book.
  async function send(payload) {
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 700));
      const free = seatsFree();
      const res = free <= 0 ? { ok: true, status: 'waitlist', position: 1 } : payload.seats > free ? { ok: false, status: 'too_many', left: free } : { ok: true, status: 'confirmed' };
      console.info('[demo] RSVP', payload, res);
      return res;
    }
    const rsvp = { ...payload, company: form.elements.company?.value || '' };
    const url = APPS_SCRIPT ? API : `${API}/rsvp`;
    // Apps Script only accepts "simple" requests, so the JSON travels as text/plain there
    const body = APPS_SCRIPT ? JSON.stringify({ action: 'rsvp', rsvp }) : JSON.stringify(rsvp);
    const headers = { 'Content-Type': APPS_SCRIPT ? 'text/plain;charset=utf-8' : 'application/json' };
    let wait = 900;
    for (let attempt = 0; attempt < 9; attempt++) {
      let res = null, out = null;
      try { res = await fetch(url, { method: 'POST', headers, body }); out = await res.json(); } catch { /* offline, dropped or throttled: retry */ }
      if (out && !out.busy && res.status !== 429 && res.status < 500) {
        if (out.status) seats.apply(out);
        if (res.status === 422 || out.invalid) throw new Error(out.error);
        return out;
      }
      if (out?.limited) throw new Error(out.error);
      if (attempt === 0) label.textContent = 'In the queue';
      const ra = Number(res?.headers.get('Retry-After'));
      await new Promise((r) => setTimeout(r, (ra ? ra * 1000 : wait) + Math.random() * 800));
      wait = Math.min(wait * 1.8, 9000);
    }
    throw new Error('Mission control is very busy right now. Hold again in a minute.');
  }

  async function fire() {
    busy = true;
    launch.classList.remove('is-holding');
    label.textContent = 'Launching';
    const payload = collect();
    try {
      const [res] = await Promise.all([send(payload), warp(document.getElementById('warp'), reduced)]);
      if (res.status === 'too_many') {
        busy = false; paintMode(); go(3);
        setCrew(Math.max(0, (res.left ?? 1) - 1));
        toast(`Only ${res.left} seat${res.left === 1 ? '' : 's'} left. We trimmed your crew to fit.`);
        return;
      }
      if (!res.ok) throw new Error(res.error || 'RSVP failed');
      data = { ...payload, status: res.status, position: res.position || null };
      save(data);
      if (DEMO) seats.setLocal(ownSeats());
      showTicket(false);
      document.dispatchEvent(new CustomEvent('rsvp:done', { detail: data }));
    } catch (err) {
      console.error(err);
      toast(err.message || 'Could not reach mission control. Check your connection and hold again.');
    } finally {
      busy = false; prog.v = 0; paintRing(); paintMode();
      gsap.set(form, { x: 0, y: 0 });
    }
  }

  /* ---------------- ticket ---------------- */
  function drawQr(canvas, text, dim) {
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), ctx = canvas.getContext('2d'), size = canvas.width, m = 2, cell = size / (n + m * 2);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = dim ? 'rgba(0,6,33,0.25)' : '#000621';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect(Math.floor((c + m) * cell), Math.floor((r + m) * cell), Math.ceil(cell), Math.ceil(cell));
  }

  let countTimer;
  function fillTicket(d) {
    const wait = d.status === 'waitlist';
    ticket.classList.toggle('is-wait', wait);
    document.getElementById('tName').textContent = d.name;
    document.getElementById('tMeta').textContent = `${d.batch.replace('UG ', 'UG · ')}${d.crew ? ` · with ${d.crew} friend${d.crew > 1 ? 's' : ''}` : ''}`;
    document.getElementById('tSeats').textContent = d.seats;
    document.getElementById('tId').textContent = d.ticketId;
    document.getElementById('tStatus').textContent = wait ? `Waitlist${d.position ? ` #${d.position}` : ''}` : `Admit ${d.seats}`;
    document.getElementById('tNote').textContent = wait ? "Not a ticket yet. We'll message you if a seat opens." : 'Show this at the door.';
    document.getElementById('tWorlds').innerHTML = (d.worlds || []).map((w) => `<span title="${w}">${SVG[WORLD_SYM[w]]}<b>${w}</b></span>`).join('');
    drawQr(document.getElementById('tQr'), qrPayload(d), wait);
    const tick = () => {
      const s = Math.floor((new Date(EVENT.start) - Date.now()) / 1000);
      const el = document.getElementById('tCount');
      if (s <= 0) { el.textContent = Date.now() < new Date(EVENT.end) ? 'Doors are open' : 'Thanks for coming'; return; }
      const dd = Math.floor(s / 86400), hh = Math.floor((s % 86400) / 3600), mm = Math.floor((s % 3600) / 60);
      el.textContent = `Launch in ${dd}d ${String(hh).padStart(2, '0')}h ${String(mm).padStart(2, '0')}m`;
    };
    tick(); clearInterval(countTimer); countTimer = setInterval(tick, 20000);
  }

  function showTicket(instant) {
    fillTicket(data);
    const first = data.name.split(' ')[0];
    const wait = data.status === 'waitlist';
    document.getElementById('doneTitle').textContent = wait ? `${first}, you're on the waitlist.` : `${first}, you're in.`;
    document.getElementById('doneLede').textContent = wait
      ? `All 300 seats are taken${data.position ? `. You're number ${data.position} in line` : ''}. If a seat opens up, we'll message you first.`
      : data.crew ? `${data.seats} seats held for you and your crew. Save the ticket and send your friends the link.` : 'Your seat is held. Save the ticket. See you on the 16th.';
    form.hidden = true; mascot.hidden = true; done.hidden = false;
    scene.setMode('ticket');
    document.documentElement.classList.add('has-ticket');
    if (instant || reduced) return;
    gsap.timeline()
      .fromTo('#doneTitle', { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, ease: 'expo.out' })
      .fromTo('.ticketwrap', { y: -innerHeight * 0.9, rotate: -24 }, { y: 0, rotate: 0, duration: 1.3, ease: 'expo.out' }, 0.1)
      .fromTo('.ticket__mascot', { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'back.out(1.8)' }, 0.9)
      .fromTo('.ticket__worlds span', { scale: 0, rotate: -90 }, { scale: 1, rotate: 0, stagger: 0.08, duration: 0.5, ease: 'back.out(2.5)' }, 1)
      .fromTo(['#doneLede', '.done__actions', '#editRsvp'], { y: 26, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.6, ease: 'expo.out' }, 1);
    confetti(reduced);
  }

  function fillForm(d) {
    form.elements.name.value = d.name;
    form.elements.email.value = d.email.replace(`@${EMAIL_DOMAIN}`, '');
    form.elements.phone.value = d.phone; form.elements.wish.value = d.wish || '';
    form.querySelectorAll('input[name=batch]').forEach((r) => { r.checked = r.value === d.batch; });
    form.querySelectorAll('input[name=worlds]').forEach((r) => { r.checked = d.worlds?.includes(r.value); });
    setCrew(d.crew || 0, false);
    (d.friends || []).forEach((f, i) => { const el = form.elements[`friend${i + 1}`]; if (el) el.value = f; });
  }

  document.getElementById('editRsvp').addEventListener('click', () => {
    fillForm(data);
    done.hidden = true; form.hidden = false; mascot.hidden = false;
    document.documentElement.classList.remove('has-ticket');
    go(0);
    if (!reduced) gsap.fromTo(form, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out' });
  });
  document.getElementById('dlPass').addEventListener('click', async () => {
    const url = await renderPassPng(data);
    const a = document.createElement('a'); a.href = url; a.download = `${data.ticketId}-milkyway-launch.png`;
    document.body.appendChild(a); a.click(); a.remove();
  });
  document.getElementById('calPass').addEventListener('click', () => downloadIcs(`Ticket ${data.ticketId}`));
  document.getElementById('sharePass').addEventListener('click', async () => {
    const text = "I'm going to The MilkyWay Launch on Fri 16 Oct. 300 seats only, RSVP with your MU email:";
    const url = location.origin + location.pathname;
    if (navigator.share) { try { await navigator.share({ title: 'The MilkyWay Launch', text, url }); return; } catch { return; } }
    try { await navigator.clipboard.writeText(`${text} ${url}`); toast('Invite copied. Paste it in the group chat.'); }
    catch { toast(`Share this link: ${url}`); }
  });

  /* ---------------- start ---------------- */
  setCrew(0, false);
  seats.subscribe(() => { if (!busy) paintMode(); });
  if (data) showTicket(true); else go(0, true);

  function introCard() {
    gsap.fromTo(form, { y: 60, opacity: 0, rotate: -2 }, { y: 0, opacity: 1, rotate: 0, duration: 1, ease: 'expo.out' });
    gsap.fromTo(splitQ(steps[0].querySelector('.step__q')), { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.05, delay: 0.25 });
    gsap.fromTo(mascot, { x: 200, y: -120, rotate: 40, opacity: 0 }, { x: 0, y: 0, rotate: 0, opacity: 1, duration: 1.3, ease: 'expo.out', delay: 0.5 });
    gsap.fromTo('.card__event > *', { y: 14, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.04, duration: 0.5, delay: 0.3 });
  }
  return { start() { if (!data && !reduced) introCard(); }, hasRsvp: () => !!data };
}

/* hyperspace while the RSVP is sent */
function warp(canvas, reduced) {
  if (reduced) return Promise.resolve();
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(devicePixelRatio || 1, 2);
  const w = canvas.width = canvas.clientWidth * DPR, h = canvas.height = canvas.clientHeight * DPR;
  const cols = ['#FFE3C5', '#F6AAC8', '#506CD9', '#EAD11F', '#FFFFFF', '#22D974'];
  const lines = Array.from({ length: 280 }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random() * 40, v: 2 + Math.random() * 10, c: cols[(Math.random() * cols.length) | 0] }));
  const start = performance.now(), D = 1500;
  return new Promise((resolve) => {
    (function f(now) {
      const k = (now - start) / D;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = `rgba(0,6,33,${Math.min(0.92, Math.sin(Math.PI * Math.min(k, 1)) * 0.95)})`;
      ctx.fillRect(0, 0, w, h);
      const sp = k < 0.7 ? k * k * 60 : 30 * (1 - k) / 0.3 + 1;
      for (const l of lines) {
        l.r += l.v * sp * DPR * 0.4;
        const x1 = w / 2 + Math.cos(l.a) * l.r, y1 = h / 2 + Math.sin(l.a) * l.r;
        const x0 = w / 2 + Math.cos(l.a) * l.r * 0.8, y0 = h / 2 + Math.sin(l.a) * l.r * 0.8;
        ctx.strokeStyle = l.c; ctx.lineWidth = 2 * DPR; ctx.globalAlpha = Math.min(1, k * 3);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        if (l.r > Math.max(w, h)) l.r = Math.random() * 20;
      }
      ctx.globalAlpha = 1;
      if (k < 1) requestAnimationFrame(f); else { ctx.clearRect(0, 0, w, h); resolve(); }
    })(start);
  });
}

/* brand-symbol confetti over the ticket */
function confetti(reduced) {
  if (reduced) return;
  const names = ['sym-explore', 'sym-imagine', 'sym-create', 'sym-connect', 'ic-vibes', 'ic-love', 'u-northstar'];
  for (let i = 0; i < 44; i++) {
    const s = document.createElement('span');
    s.className = 'confetti';
    s.innerHTML = SVG[names[i % names.length]];
    s.style.cssText = `left:${Math.random() * 100}%;width:${14 + Math.random() * 26}px`;
    document.body.appendChild(s);
    gsap.to(s, {
      y: innerHeight + 160, x: (Math.random() - 0.5) * 260, rotate: (Math.random() - 0.5) * 900,
      duration: 2.4 + Math.random() * 1.8, ease: 'power1.in', delay: Math.random() * 0.7, onComplete: () => s.remove(),
    });
  }
}
