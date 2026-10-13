// The site's own server on Vercel (api/). Demo builds (VITE_DEMO=1, used for previews) keep
// RSVPs in the browser only and never call it.
// Where RSVPs go, in order of preference:
//   1. env.js (window.MW_CONFIG.api), editable on the host without a rebuild: an Apps Script /exec URL
//   2. VITE_API_BASE at build time
//   3. '/api', the Vercel functions in api/
// Pages builds (VITE_PAGES=1) with no URL yet, and demo builds (VITE_DEMO=1), run as a preview:
// everything works but RSVPs stay in the browser and a "Preview" label says so.
const runtime = (typeof window !== 'undefined' && window.MW_CONFIG?.api) || '';
export const API = runtime || import.meta.env.VITE_API_BASE || '/api';
export const DEMO = import.meta.env.VITE_DEMO === '1' || (import.meta.env.VITE_PAGES === '1' && !runtime && !import.meta.env.VITE_API_BASE);
// On static hosting there is no server: the site talks straight to the sheet's Apps Script web app.
export const APPS_SCRIPT = import.meta.env.VITE_API_MODE === 'apps-script' || /script\.google(usercontent)?\.com|\/exec\/?$/.test(API);

export const EVENT = {
  title: 'The MilkyWay Launch',
  start: '2026-10-16T14:45:00+05:30',
  end: '2026-10-16T21:30:00+05:30',
  venue: 'Auditorium, 8th Floor, CDS Tower, Masters\' Union',
  email: 'milkyway@mastersunion.org',
  url: typeof location !== 'undefined' ? location.origin : '',
};

// Only Masters' Union UG students can RSVP, with their university email.
export const EMAIL_DOMAIN = 'mastersunion.org';

export const MAX_CREW = 4;

// The launch auditorium holds 300. Every seat counts, friends included.
export const SEAT_CAP = 300;
