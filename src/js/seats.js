import { API, APPS_SCRIPT, DEMO, SEAT_CAP } from '../config.js';

// Live seat count from /api/seats (edge-cached), refreshed every ~20 s while the tab is visible.
// Demo builds count only this browser's own RSVP.
const state = { cap: SEAT_CAP, taken: 0, waitlist: 0, live: false, loaded: false };
const subs = new Set();
let localSeats = 0;

export const seats = {
  get: () => ({ ...state, left: Math.max(0, state.cap - state.taken), full: state.taken >= state.cap }),
  subscribe(fn) { subs.add(fn); fn(seats.get()); return () => subs.delete(fn); },
  setLocal(n) { localSeats = n; if (!state.live) { state.taken = n; emit(); } },
  apply(s) {
    if (typeof s?.cap === 'number') state.cap = s.cap;
    if (typeof s?.taken === 'number') state.taken = s.taken;
    if (typeof s?.waitlist === 'number') state.waitlist = s.waitlist;
    emit();
  },
  refresh,
};

function emit() { const v = seats.get(); subs.forEach((fn) => fn(v)); }

async function refresh() {
  if (DEMO) { state.loaded = true; state.taken = localSeats; emit(); return; }
  try {
    const res = await fetch(APPS_SCRIPT ? `${API}?action=status` : `${API}/seats`);
    if (!res.ok) throw new Error(String(res.status));
    const d = await res.json();
    state.live = true; state.loaded = true;
    seats.apply(d);
  } catch (e) {
    state.live = false; emit();
  }
}

export function startSeats() {
  refresh();
  if (DEMO) return;
  // a little jitter so thousands of tabs don't refresh in lockstep
  const tick = () => setTimeout(() => { if (!document.hidden) refresh(); tick(); }, 18000 + Math.random() * 6000);
  tick();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
}

// Paint every [data-seats] element in the page from the current state.
export function bindSeatsUi() {
  const root = document.documentElement;
  let last = null;
  seats.subscribe((s) => {
    document.querySelectorAll('[data-seats-left]').forEach((el) => { el.textContent = s.left; });
    document.querySelectorAll('[data-seats-cap]').forEach((el) => { el.textContent = s.cap; });
    root.classList.toggle('is-live', s.live);
    root.classList.toggle('is-low', !s.full && s.left <= 30);
    root.classList.toggle('is-full', s.full);
    document.querySelectorAll('.seats__label').forEach((el) => { el.textContent = s.full ? ' full · waitlist open' : ' seats left'; });
    if (last !== null && last !== s.left) {
      document.querySelectorAll('[data-seats-left]').forEach((el) => {
        el.animate([{ transform: 'translateY(-30%)', opacity: 0.2 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      });
    }
    last = s.left;
  });
}
