import './styles.css';
import { StringTune, StringMagnetic, StringTilt } from '@fiddle-digital/string-tune';
import { injectSvgs } from './js/svg.js';
import { initScene } from './js/scene.js';
import { initCursor } from './js/cursor.js';
import { runLoader } from './js/intro.js';
import { initFaq } from './js/faq.js';
import { initRsvp, readSaved } from './js/rsvp.js';
import { seats, startSeats, bindSeatsUi } from './js/seats.js';
import { DEMO } from './config.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

injectSvgs();
document.getElementById('previewTag').hidden = !DEMO;

// StringTune: magnetic buttons and the tilting ticket (with its holographic sheen).
if (!reduced) {
  const st = StringTune.getInstance();
  st.scrollDesktopMode = 'default';
  st.scrollMobileMode = 'default';
  [StringMagnetic, StringTilt].forEach((m) => st.use(m));
  st.start(60);
}

const scene = initScene(document.getElementById('scene'), { reduced });
initCursor();
initFaq({ reduced });

const toastEl = document.getElementById('toast');
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 3600);
}

const saved = readSaved();
bindSeatsUi();
if (saved?.status === 'confirmed') seats.setLocal(saved.seats);
startSeats();

const rsvp = initRsvp({ reduced, scene, toast });

document.body.classList.add('is-loading');
runLoader({ reduced, quick: !!saved }).then(() => {
  document.body.classList.remove('is-loading');
  rsvp.start();
});
