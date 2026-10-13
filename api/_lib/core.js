// The RSVP server. Redis holds the live seat ledger (atomic, fast); the Google Sheet is the
// register the team reads, written right after each RSVP and retried from a queue if Google
// is slow. Everything here is plain functions over injected clients, so tests can run it
// against a local Redis and a fake sheet.

export const DOMAIN = '@mastersunion.org';
export const MAX_CREW = 4;

export const K = {
  taken: 'mw:taken',          // seats confirmed, friends included
  seats: 'mw:seats',          // hash email -> seats held
  waitpos: 'mw:waitpos',      // hash email -> place in line
  waitcount: 'mw:waitcount',  // people on the waitlist now
  waitseq: 'mw:waitseq',      // next place in line
  rec: (email) => `mw:rec:${email}`, // latest RSVP record, JSON
  pending: 'mw:pending',      // sheet writes waiting to be retried
};

// One atomic step: give back this email's old seats, then confirm, refuse, or waitlist.
export const RESERVE_LUA = `
local mine = tonumber(redis.call('HGET', KEYS[2], ARGV[1]) or '0')
local taken = tonumber(redis.call('GET', KEYS[1]) or '0')
local need = tonumber(ARGV[2])
local cap = tonumber(ARGV[3])
local free = cap - taken + mine
if free >= need then
  redis.call('HSET', KEYS[2], ARGV[1], need)
  taken = taken - mine + need
  redis.call('SET', KEYS[1], taken)
  if redis.call('HDEL', KEYS[3], ARGV[1]) == 1 then redis.call('DECR', KEYS[4]) end
  return {'confirmed', taken, 0, cap - taken}
end
if free > 0 or mine > 0 then
  return {'too_many', taken, 0, free}
end
local pos = redis.call('HGET', KEYS[3], ARGV[1])
if not pos then
  pos = redis.call('INCR', KEYS[5])
  redis.call('HSET', KEYS[3], ARGV[1], pos)
  redis.call('INCR', KEYS[4])
end
return {'waitlist', taken, tonumber(pos), 0}
`;

// Rebuild the ledger from the sheet (after the team deletes or moves rows), without dropping
// RSVPs made in the last few minutes that may not have reached the sheet yet.
export const SYNC_LUA = `
local now = tonumber(ARGV[1])
local grace = tonumber(ARGV[2])
local n = tonumber(ARGV[3])
local keep = {}
local idx = 4
for i = 1, n do keep[ARGV[idx]] = tonumber(ARGV[idx + 1]); idx = idx + 2 end
local wn = tonumber(ARGV[idx]); idx = idx + 1
local wkeep = {}
for i = 1, wn do wkeep[ARGV[idx]] = i; idx = idx + 1 end
-- recent RSVPs not yet in the sheet stay
local cur = redis.call('HGETALL', KEYS[2])
for i = 1, #cur, 2 do
  local email = cur[i]
  if keep[email] == nil and wkeep[email] == nil then
    local rec = redis.call('GET', 'mw:rec:' .. email)
    if rec then
      local ts = tonumber(string.match(rec, '"ts":(%d+)') or '0')
      if now - ts < grace then keep[email] = tonumber(cur[i + 1]) end
    end
  end
end
redis.call('DEL', KEYS[2])
local taken = 0
for email, s in pairs(keep) do redis.call('HSET', KEYS[2], email, s); taken = taken + s end
redis.call('SET', KEYS[1], taken)
redis.call('DEL', KEYS[3])
local count = 0
for email, pos in pairs(wkeep) do
  if keep[email] == nil then redis.call('HSET', KEYS[3], email, pos); count = count + 1 end
end
redis.call('SET', KEYS[4], count)
redis.call('SET', KEYS[5], wn)
return {taken, count}
`;

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

export function validate(body) {
  const b = body && typeof body === 'object' ? body : {};
  if (b.company) return { bot: true }; // honeypot: people never see this field
  const email = clean(b.email, 90).toLowerCase();
  const name = clean(b.name, 40);
  const phone = clean(b.phone, 16);
  const batch = clean(b.batch, 20);
  const crew = Math.max(0, Math.min(MAX_CREW, Number.parseInt(b.crew, 10) || 0));
  if (name.length < 2) return { error: 'Type your name so we can print it on the ticket.' };
  if (!email.endsWith(DOMAIN) || !/^[a-z0-9._%+-]{2,}@mastersunion\.org$/.test(email)) return { error: `Only ${DOMAIN} emails can RSVP.` };
  if (phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').length !== 10) return { error: 'Phone numbers need 10 digits.' };
  if (!/^UG Year [1-4]$/.test(batch)) return { error: 'Pick your batch.' };
  const worlds = (Array.isArray(b.worlds) ? b.worlds : []).filter((w) => ['Imagine', 'Explore', 'Create', 'Connect'].includes(w));
  const friends = (Array.isArray(b.friends) ? b.friends : []).slice(0, crew).map((f) => clean(f, 40)).filter(Boolean);
  return {
    rsvp: {
      ticketId: clean(b.ticketId, 12), name, email, phone, batch, crew, seats: 1 + crew, friends, worlds,
      wish: clean(b.wish, 120), page: clean(b.page, 200),
    },
  };
}

export async function status(redis, cap) {
  const [taken, wait] = await Promise.all([redis.get(K.taken), redis.get(K.waitcount)]);
  const t = Number(taken) || 0;
  return { ok: true, cap, taken: t, left: Math.max(0, cap - t), waitlist: Number(wait) || 0 };
}

// Fixed-window rate limit. Returns true when the caller is over the limit.
export async function limited(redis, key, max, windowSec) {
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, windowSec);
  return n > max;
}

export async function reserve(redis, rsvp, cap) {
  const res = await redis.eval(RESERVE_LUA, [K.taken, K.seats, K.waitpos, K.waitcount, K.waitseq], [rsvp.email, rsvp.seats, cap]);
  const [st, taken, position, left] = res;
  const out = { status: st, taken: Number(taken), cap, left: Math.max(0, Number(left)), position: Number(position) || null };
  if (st === 'confirmed' || st === 'waitlist') {
    await redis.set(K.rec(rsvp.email), JSON.stringify({ ...rsvp, status: st, position: out.position, ts: Date.now() }));
  }
  return out;
}

/* ---------------- the sheet ---------------- */

export function sheetClient(url, secret, fetchImpl = fetch) {
  return async (payload, timeoutMs = 12000) => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        method: 'POST', redirect: 'follow', signal: ctl.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...payload, secret }),
      });
      const text = await res.text();
      let json; try { json = JSON.parse(text); } catch { throw new Error(`sheet replied ${res.status}: ${text.slice(0, 120)}`); }
      // a booking answer (too_many) comes back with ok:false and a status: pass it on, it is not a failure
      if (!json.ok && !json.status) throw new Error(json.error || 'sheet refused the write');
      return json;
    } finally { clearTimeout(t); }
  };
}

export const sheetJob = (rsvp, st, position) => ({
  action: 'upsert', table: st === 'waitlist' ? 'Waitlist' : 'RSVPs',
  row: { ...rsvp, status: st === 'waitlist' ? `waitlist #${position}` : 'confirmed', submittedAt: new Date().toISOString() },
});

// Every RSVP goes into a queue; one drainer at a time (guarded by a Redis lock) writes the queue to
// the sheet in batches. Apps Script never sees more than one call at once, and a failed batch stays
// at the front of the queue for the next try. Nothing is ever lost and order is kept.
export const enqueue = (redis, job) => redis.rpush(K.pending, JSON.stringify(job));

const UNLOCK_LUA = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0";

export async function drain(redis, sheet, { budgetMs = 20000, batch = 50 } = {}) {
  const token = `${Date.now()}-${Math.random()}`;
  const got = await redis.set('mw:drainlock', token, { nx: true, ex: Math.ceil(budgetMs / 1000) + 10 });
  if (!got) return { written: 0, skipped: true };
  const stop = Date.now() + budgetMs;
  let written = 0, failed = false;
  try {
    while (Date.now() < stop) {
      const raw = await redis.lrange(K.pending, 0, batch - 1);
      if (!raw || !raw.length) break;
      const jobs = raw.map((j) => (typeof j === 'string' ? JSON.parse(j) : j));
      try { await sheet({ action: 'upsertMany', jobs }, 25000); } catch (e) { failed = true; break; }
      await redis.ltrim(K.pending, raw.length, -1); // only the lock holder removes from the head
      written += raw.length;
    }
  } finally {
    await redis.eval(UNLOCK_LUA, ['mw:drainlock'], [token]);
  }
  return { written, failed };
}

export async function syncFromSheet(redis, { rsvps, waitlist }, graceMs = 10 * 60 * 1000) {
  const args = [Date.now(), graceMs, rsvps.length];
  for (const r of rsvps) args.push(String(r.email).toLowerCase(), Number(r.seats) || 1);
  args.push(waitlist.length, ...waitlist.map((e) => String(e).toLowerCase()));
  const [taken, wait] = await redis.eval(SYNC_LUA, [K.taken, K.seats, K.waitpos, K.waitcount, K.waitseq], args);
  return { taken: Number(taken), waitlist: Number(wait) };
}

export const json = (data, init = {}) => new Response(JSON.stringify(data), {
  status: init.status || 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init.headers || {}) },
});

export const clientIp = (request) => (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
