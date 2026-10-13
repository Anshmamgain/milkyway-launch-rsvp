import autocannon from 'autocannon';
import { start } from './harness.mjs';
import { syncFromSheet, K, validate } from '../api/_lib/core.js';

const PORT = 8790, base = `http://localhost:${PORT}`;
const h = await start({ port: PORT });
const say = (...a) => console.log(...a);
const post = (body, ip = `10.${Math.random() * 255 | 0}.${Math.random() * 255 | 0}.${Math.random() * 255 | 0}`) =>
  fetch(`${base}/api/rsvp`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) });
const person = (i, crew) => ({ name: `Student ${i}`, email: `student${i}@mastersunion.org`, phone: '98765 43210', batch: `UG Year ${1 + (i % 4)}`, crew, worlds: ['Imagine'], ticketId: `MW-${i}` });

// 1. validation
say('validation:', validate({ ...person(1, 0), email: 'x@gmail.com' }).error, '|', validate({ ...person(1, 9) }).rsvp.crew, '(crew capped)');
say('honeypot:', (await (await post({ ...person(9999, 0), company: 'spam inc' })).json()).status, '(pretends success, books nothing):', await h.io.hlen(K.seats));

// 2. the rush: 2000 students hit "hold to launch" at once, 250 requests in flight at a time
const N = 2000, C = 250; let i = 0; const codes = {}; const statuses = {}; const t0 = Date.now(); const lat = [];
async function worker() {
  while (i < N) {
    const me = i++; const s = Date.now();
    const r = await post(person(me, me % 5));
    lat.push(Date.now() - s);
    codes[r.status] = (codes[r.status] || 0) + 1;
    const j = await r.json(); statuses[j.status || j.error] = (statuses[j.status || j.error] || 0) + 1;
  }
}
await Promise.all(Array.from({ length: C }, worker));
lat.sort((a, b) => a - b);
const secs = (Date.now() - t0) / 1000;
const seatsHash = await h.io.hgetall(K.seats);
const sumSeats = Object.values(seatsHash).reduce((a, b) => a + Number(b), 0);
say(`\nrush: ${N} RSVPs in ${secs.toFixed(1)} s (${(N / secs).toFixed(0)}/s), p50 ${lat[N / 2 | 0]} ms, p99 ${lat[N * 0.99 | 0]} ms`);
say('HTTP codes:', codes, '| outcomes:', statuses);
say(`ledger: taken=${await h.io.get(K.taken)} sum of seats=${sumSeats} people=${Object.keys(seatsHash).length} waitlist=${await h.io.get(K.waitcount)}`);
say(`oversold? ${sumSeats > 300 ? 'YES (BUG)' : 'no'}`);

// 3. idempotency: one student mashes the button 25 times at once
const dup = await Promise.all(Array.from({ length: 25 }, () => post(person(0, 2), '1.2.3.4').then((r) => r.json())));
say('\n25 duplicate submits ->', [...new Set(dup.map((d) => d.status || d.error))], `| seats held by student0: ${await h.io.hget(K.seats, 'student0@mastersunion.org')} | taken still ${await h.io.get(K.taken)}`);

// 4. the sheet: writes that failed during the rush are queued, then flushed
await new Promise((r) => setTimeout(r, 3000));
say(`\nsheet during rush: ${h.sheet.stats.calls} calls, ${h.sheet.stats.failures} random failures, ${h.sheet.stats.busy} busy refusals; queued now: ${await h.io.llen(K.pending)}`);
let rounds = 0;
while ((await h.io.llen(K.pending)) > 0 && rounds < 60) { await fetch(`${base}/api/flush`); rounds++; if ((await h.io.llen(K.pending)) > 0) await new Promise((r) => setTimeout(r, 500)); }
const sheetRows = h.sheet.tables.RSVPs.size, sheetWait = h.sheet.tables.Waitlist.size;
const sheetSeats = [...h.sheet.tables.RSVPs.values()].reduce((a, r) => a + r.seats, 0);
say(`after ${rounds} flush calls: queue ${await h.io.llen(K.pending)} | sheet RSVPs rows=${sheetRows} (seats ${sheetSeats}) Waitlist rows=${sheetWait}`);
say(`sheet matches ledger? ${sheetRows === Object.keys(seatsHash).length && sheetSeats === sumSeats ? 'yes' : 'NO'}`);

// 5. admin frees seats from the sheet and syncs
const victims = [...h.sheet.tables.RSVPs.keys()].slice(0, 3);
const freed = victims.reduce((a, e) => a + h.sheet.tables.RSVPs.get(e).seats, 0);
victims.forEach((e) => h.sheet.tables.RSVPs.delete(e));
const out = await syncFromSheet(h.io && { eval: (s, k, a) => h.io.eval(s, k.length, ...k, ...a) }, {
  rsvps: [...h.sheet.tables.RSVPs.values()].map((r) => ({ email: r.email, seats: r.seats })),
  waitlist: [...h.sheet.tables.Waitlist.keys()],
}, 0);
say(`\nadmin deleted 3 rows (${freed} seats) and synced -> taken ${out.taken} (was ${sumSeats}), waitlist ${out.waitlist}`);

// 6. read load: the live seat count (no edge cache here, so this is the worst case per region)
const r = await autocannon({ url: `${base}/api/seats`, connections: 300, duration: 8 });
say(`\nseat-count reads: ${r.requests.average.toFixed(0)} req/s avg, p99 ${r.latency.p99} ms, errors ${r.errors}, non-2xx ${r.non2xx}, total ${r.requests.total}`);

await h.close();
process.exit(0);
