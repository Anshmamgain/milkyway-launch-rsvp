import { waitUntil } from '@vercel/functions';
import { validate, reserve, limited, sheetJob, enqueue, drain, json, clientIp } from './_lib/core.js';
import { getRedis, sheet, CAP } from './_lib/deps.js';

// POST /api/rsvp: validate, reserve atomically in Redis, answer at once. The row joins a queue
// that is written to the Google Sheet in batches, in the background.
export async function POST(request) {
  const noStore = { 'Cache-Control': 'no-store' };
  let body;
  try { body = await request.json(); } catch {
    try { body = JSON.parse(await request.text()); } catch { return json({ ok: false, error: 'Bad request.' }, { status: 400, headers: noStore }); }
  }
  const v = validate(body);
  if (v.bot) return json({ ok: true, status: 'confirmed', taken: 0, cap: CAP, left: 0 }, { headers: noStore });
  if (v.error) return json({ ok: false, error: v.error }, { status: 422, headers: noStore });
  const rsvp = v.rsvp;

  const redis = getRedis();
  const s = sheet();
  try {
    if (!redis) {
      // No Redis configured: the sheet does the atomic reservation itself (slower, still safe).
      if (!s) return json({ ok: false, error: 'RSVPs are not open yet.' }, { status: 503, headers: noStore });
      const out = await s({ action: 'reserve', rsvp }, 25000);
      return json(out, { headers: noStore });
    }

    if (await limited(redis, `mw:rl:ip:${clientIp(request)}`, 30, 600)
      || await limited(redis, `mw:rl:em:${rsvp.email}`, 8, 600)) {
      return json({ ok: false, error: 'Too many tries. Wait a few minutes and hold again.' }, { status: 429, headers: { ...noStore, 'Retry-After': '60' } });
    }

    const out = await reserve(redis, rsvp, CAP);
    if (out.status === 'confirmed' || out.status === 'waitlist') {
      await enqueue(redis, sheetJob(rsvp, out.status, out.position));
      // after answering, write the queue to the sheet (only one drainer runs at a time)
      if (s) waitUntil(drain(redis, s).catch((e) => console.error('sheet', e)));
    }
    return json({ ok: out.status !== 'too_many', ...out }, { headers: noStore });
  } catch (e) {
    console.error('rsvp', e);
    return json({ ok: false, error: 'Mission control is busy. Hold again in a moment.' }, { status: 503, headers: { ...noStore, 'Retry-After': '3' } });
  }
}
