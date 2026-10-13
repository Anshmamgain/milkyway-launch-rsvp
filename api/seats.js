import { status, json } from './_lib/core.js';
import { getRedis, sheet, CAP } from './_lib/deps.js';

// GET /api/seats: the live count. Cached at Vercel's edge for 10 s (and served stale for
// 60 s while it refreshes), so thousands of open tabs cost a few Redis reads a minute.
export async function GET() {
  const cache = { 'Cache-Control': 'public, max-age=0, s-maxage=10, stale-while-revalidate=60' };
  try {
    const redis = getRedis();
    if (redis) return json(await status(redis, CAP), { headers: cache });
    const s = sheet();
    if (!s) return json({ ok: false, error: 'Seat ledger is not configured.' }, { status: 503 });
    const out = await s({ action: 'status' });
    return json({ ok: true, cap: out.cap, taken: out.taken, left: out.left, waitlist: out.waitlist }, { headers: cache });
  } catch (e) {
    console.error('seats', e);
    return json({ ok: false, error: 'Seat count unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
