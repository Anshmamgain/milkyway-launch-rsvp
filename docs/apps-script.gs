/**
 * MilkyWay Launch RSVPs: the sheet's side of the backend.
 * Sheet: "MilkyWay Launch RSVPs" (tabs: Dashboard, RSVPs, Waitlist) in milkyway@mastersunion.org's Drive.
 *
 * Two ways to run it:
 *   A. GitHub Pages (no server): the site calls this script directly. Seat counts come from
 *      doGet ?action=status (cached 15 s) and RSVPs from doPost {action:'rsvp'}, booked under the
 *      script lock so the 300 cap holds. Leave SECRET and SITE_URL as they are if you only use this.
 *   B. Vercel + Redis: the site's server books seats in Redis and writes here with SECRET:
 *   - upsertMany: write a batch of RSVPs (moving people between RSVPs and Waitlist as needed)
 *   - reserve: atomic booking done by the sheet itself, used only if the server has no Redis
 *   - status:  seat counts, used only if the server has no Redis
 *
 * Setup (once):
 *   1. In the sheet: Extensions → Apps Script. Replace everything with this file. Save.
 *      If that shows "Sorry, unable to open the file" (several Google accounts signed in), use a
 *      private window with only the sheet owner's account, or create the project at script.google.com
 *      and set SHEET_ID below.
 *   2. (Setup B only) Set SECRET to the same value as SHEET_SECRET in Vercel, and SITE_URL.
 *   3. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone. Deploy, allow access.
 *   4. Copy the /exec URL. Setup A: send it to whoever builds the site. Setup B: Vercel → SHEET_URL.
 *   After editing this file later: Deploy → Manage deployments → Edit → Version: New version.
 *
 * Managing seats: delete a row in RSVPs to free its seats, or move a row from Waitlist to RSVPs
 * to give someone a seat. Then use the menu: Milky Way → Refresh the live seat count.
 */
// Only needed if you created this script at script.google.com instead of via Extensions → Apps Script:
// paste the sheet's ID (the long part of its URL between /d/ and /edit).
const SHEET_ID = '';
const SECRET = 'PASTE-THE-SAME-VALUE-AS-SHEET_SECRET';
const SITE_URL = 'https://YOUR-PROJECT.vercel.app';
const CAP = 300;
const DOMAIN = '@mastersunion.org';
const HEADERS = ['submittedAt', 'ticketId', 'name', 'email', 'phone', 'batch', 'crew', 'seats', 'friends', 'worlds', 'wish', 'status', 'checkedIn', 'page'];
const COL = Object.fromEntries(HEADERS.map((h, i) => [h, i]));

function book_() {
  return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

function tab_(name) {
  const ss = book_();
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) { sh.appendRow(HEADERS); sh.setFrozenRows(1); }
  return sh;
}

// Find the row number (1-based) of an email in a tab, reading only the email column.
function rowOf_(sh, email) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const emails = sh.getRange(2, COL.email + 1, last - 1, 1).getValues();
  for (let i = 0; i < emails.length; i++) if (String(emails[i][0]).toLowerCase() === email) return i + 2;
  return -1;
}

function toRow_(d, existing) {
  return HEADERS.map((h) => {
    if (h === 'submittedAt') return d.submittedAt ? new Date(d.submittedAt) : new Date();
    if (h === 'checkedIn') return existing ? existing[COL.checkedIn] : false; // never overwrite a check-in
    if (h === 'seats') return Number(d.seats) || 1 + (Number(d.crew) || 0);
    const v = d[h];
    return Array.isArray(v) ? v.join(', ') : (v === undefined || v === null ? '' : v);
  });
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function counts_() {
  const rs = tab_('RSVPs'), wl = tab_('Waitlist');
  const last = rs.getLastRow();
  const taken = last < 2 ? 0 : rs.getRange(2, COL.seats + 1, last - 1, 1).getValues().reduce((n, r) => n + (Number(r[0]) || 0), 0);
  return { cap: CAP, taken, left: Math.max(0, CAP - taken), waitlist: Math.max(0, wl.getLastRow() - 1) };
}

function upsert_(table, d) {
  const email = String(d.email || '').toLowerCase();
  if (!email.endsWith(DOMAIN)) throw new Error('Only ' + DOMAIN + ' emails.');
  d.email = email;
  const target = tab_(table), other = tab_(table === 'RSVPs' ? 'Waitlist' : 'RSVPs');
  const o = rowOf_(other, email);
  if (o > 0) other.deleteRow(o);
  const r = rowOf_(target, email);
  if (r > 0) {
    const existing = target.getRange(r, 1, 1, HEADERS.length).getValues()[0];
    target.getRange(r, 1, 1, HEADERS.length).setValues([toRow_(d, existing)]);
  } else {
    target.appendRow(toRow_(d, null));
    target.getRange(target.getLastRow(), COL.checkedIn + 1).insertCheckboxes(); // tick at the door
  }
}

// Many RSVPs in one go (the server sends batches of up to 50): one read of each tab's emails,
// in-memory moves between the tabs, then bulk writes. Later jobs for the same email win.
function upsertMany_(jobs) {
  const names = ['RSVPs', 'Waitlist'];
  const T = {};
  names.forEach((n) => {
    const sh = tab_(n), last = sh.getLastRow();
    const vals = last < 2 ? [] : sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
    const rows = new Map();
    vals.forEach((r, i) => { if (r[COL.email]) rows.set(String(r[COL.email]).toLowerCase(), i + 2); });
    T[n] = { sh, vals, rows, updates: new Map(), deletes: new Set(), appends: new Map() };
  });
  jobs.forEach((j) => {
    const d = j.row || {};
    const email = String(d.email || '').toLowerCase();
    if (!email.endsWith(DOMAIN)) return;
    d.email = email;
    const target = T[j.table === 'Waitlist' ? 'Waitlist' : 'RSVPs'];
    const other = T[j.table === 'Waitlist' ? 'RSVPs' : 'Waitlist'];
    other.appends.delete(email);
    if (other.rows.has(email)) { const idx = other.rows.get(email); other.deletes.add(idx); other.updates.delete(idx); other.rows.delete(email); }
    if (target.rows.has(email)) {
      const idx = target.rows.get(email);
      target.updates.set(idx, toRow_(d, target.vals[idx - 2]));
    } else {
      target.appends.set(email, toRow_(d, null));
    }
  });
  names.forEach((n) => {
    const t = T[n];
    t.updates.forEach((row, idx) => t.sh.getRange(idx, 1, 1, HEADERS.length).setValues([row]));
    Array.from(t.deletes).sort((a, b) => b - a).forEach((idx) => t.sh.deleteRow(idx));
    const add = Array.from(t.appends.values());
    if (add.length) {
      const first = t.sh.getLastRow() + 1;
      t.sh.getRange(first, 1, add.length, HEADERS.length).setValues(add);
      t.sh.getRange(first, COL.checkedIn + 1, add.length, 1).insertCheckboxes();
    }
  });
  return jobs.length;
}

function reserve_(d) {
  const email = String(d.email || '').toLowerCase();
  if (!email.endsWith(DOMAIN)) return { ok: false, error: 'Only ' + DOMAIN + ' emails can RSVP.' };
  const need = 1 + Math.max(0, Math.min(4, Number(d.crew) || 0));
  const rs = tab_('RSVPs');
  const r = rowOf_(rs, email);
  const mine = r > 0 ? Number(rs.getRange(r, COL.seats + 1).getValue()) || 0 : 0;
  const c = counts_();
  const free = c.left + mine;
  if (free >= need) {
    upsert_('RSVPs', Object.assign({}, d, { seats: need, status: 'confirmed' }));
    return Object.assign({ ok: true, status: 'confirmed' }, counts_());
  }
  if (free > 0 || mine > 0) return Object.assign({ ok: false, status: 'too_many' }, counts_(), { left: free });
  const wl = tab_('Waitlist');
  let pos = rowOf_(wl, email);
  pos = pos > 0 ? pos - 1 : wl.getLastRow();
  upsert_('Waitlist', Object.assign({}, d, { seats: need, status: 'waitlist #' + pos }));
  return Object.assign({ ok: true, status: 'waitlist', position: pos }, counts_());
}

/* ---------------- public endpoints (when the site talks to this script directly) ---------------- */

// Seat counts, cached for 15 s so hundreds of open tabs cost almost nothing.
function cachedCounts_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('counts');
  if (hit) return JSON.parse(hit);
  const c = counts_();
  cache.put('counts', JSON.stringify(c), 15);
  return c;
}

function clean_(v, max) { return String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max); }

function validate_(b) {
  if (b.company) return { bot: true };
  const email = clean_(b.email, 90).toLowerCase();
  const crew = Math.max(0, Math.min(4, parseInt(b.crew, 10) || 0));
  const r = {
    ticketId: clean_(b.ticketId, 12), name: clean_(b.name, 40), email: email, phone: clean_(b.phone, 16), batch: clean_(b.batch, 20),
    crew: crew, seats: 1 + crew, wish: clean_(b.wish, 120), page: clean_(b.page, 200),
    friends: (Array.isArray(b.friends) ? b.friends : []).slice(0, crew).map((f) => clean_(f, 40)).filter(String),
    worlds: (Array.isArray(b.worlds) ? b.worlds : []).filter((w) => ['Imagine', 'Explore', 'Create', 'Connect'].indexOf(w) >= 0),
    submittedAt: new Date().toISOString(),
  };
  if (r.name.length < 2) return { error: 'Type your name so we can print it on the ticket.' };
  if (!/^[a-z0-9._%+-]{2,}@mastersunion\.org$/.test(email)) return { error: 'Only ' + DOMAIN + ' emails can RSVP.' };
  if (r.phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').length !== 10) return { error: 'Phone numbers need 10 digits.' };
  if (!/^UG Year [1-4]$/.test(r.batch)) return { error: 'Pick your batch.' };
  return { rsvp: r };
}

function publicRsvp_(body) {
  const v = validate_(body || {});
  if (v.bot) return { ok: true, status: 'confirmed', cap: CAP, taken: 0, left: 0 };
  if (v.error) return { ok: false, error: v.error, invalid: true };
  const cache = CacheService.getScriptCache();
  const key = 'rl:' + v.rsvp.email;
  const n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), 600);
  if (n > 8) return { ok: false, error: 'Too many tries. Wait a few minutes and hold again.', limited: true };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(28000)) return { ok: false, error: 'busy', busy: true };
  try {
    const out = reserve_(v.rsvp);
    cache.remove('counts');
    return out;
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'status') return json_(Object.assign({ ok: true }, cachedCounts_()));
  return json_({ ok: true, service: 'milkyway-rsvp' });
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Bad JSON' }); }
  if (d.action === 'rsvp') { try { return json_(publicRsvp_(d.rsvp)); } catch (err) { return json_({ ok: false, error: String(err), busy: true }); } }
  if (!SECRET || SECRET.indexOf('PASTE') === 0 || d.secret !== SECRET) return json_({ ok: false, error: 'Unauthorised' });
  if (d.action === 'status') return json_(Object.assign({ ok: true }, counts_()));
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return json_({ ok: false, error: 'busy' });
  try {
    if (d.action === 'upsertMany') return json_({ ok: true, written: upsertMany_(d.jobs || []) });
    if (d.action === 'upsert') { upsert_(d.table === 'Waitlist' ? 'Waitlist' : 'RSVPs', d.row || {}); return json_({ ok: true }); }
    if (d.action === 'reserve') return json_(reserve_(d.rsvp || {}));
    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- menu ---------------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Milky Way')
    .addItem('Refresh the live seat count', 'refreshCount')
    .addItem('Sync seats to the site (Vercel setup only)', 'syncSeats')
    .addItem('Check the connection', 'checkSetup')
    .addToUi();
}

// Run this from the editor (select it, click Run) or the sheet's menu after editing rows by hand.
function refreshCount() {
  CacheService.getScriptCache().remove('counts');
  const c = counts_();
  const msg = `The site now shows ${c.left} of ${c.cap} seats left, ${c.waitlist} on the waitlist.`;
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }
}

function syncSeats() {
  const rs = tab_('RSVPs'), wl = tab_('Waitlist');
  const rv = rs.getLastRow() < 2 ? [] : rs.getRange(2, 1, rs.getLastRow() - 1, HEADERS.length).getValues();
  const wv = wl.getLastRow() < 2 ? [] : wl.getRange(2, 1, wl.getLastRow() - 1, HEADERS.length).getValues();
  const body = {
    secret: SECRET,
    rsvps: rv.filter((r) => r[COL.email]).map((r) => ({ email: String(r[COL.email]).toLowerCase(), seats: Number(r[COL.seats]) || 1 })),
    waitlist: wv.filter((r) => r[COL.email]).map((r) => String(r[COL.email]).toLowerCase()),
  };
  const res = UrlFetchApp.fetch(SITE_URL + '/api/admin-sync', { method: 'post', contentType: 'text/plain', payload: JSON.stringify(body), muteHttpExceptions: true });
  const out = JSON.parse(res.getContentText() || '{}');
  SpreadsheetApp.getUi().alert(out.ok ? `Synced. The site now shows ${CAP - out.taken} of ${CAP} seats left, ${out.waitlist} on the waitlist.` : `Sync failed: ${out.error || res.getResponseCode()}`);
}

function checkSetup() {
  const problems = [];
  if (SECRET.indexOf('PASTE') === 0) problems.push('SECRET is not set.');
  if (SITE_URL.indexOf('YOUR-PROJECT') >= 0) problems.push('SITE_URL is not set.');
  let seats = '';
  try { const r = UrlFetchApp.fetch(SITE_URL + '/api/seats', { muteHttpExceptions: true }); seats = r.getContentText(); } catch (e) { problems.push('Could not reach the site: ' + e); }
  SpreadsheetApp.getUi().alert(problems.length ? problems.join('\n') : 'Connected. The site reports: ' + seats);
}
