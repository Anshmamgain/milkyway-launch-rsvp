import { drain, json, K } from './_lib/core.js';
import { getRedis, sheet } from './_lib/deps.js';

// GET /api/flush: retries queued sheet writes. Run by Vercel Cron, and safe to call any time.
export async function GET(request) {
  const auth = request.headers.get('authorization');
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) return json({ ok: false }, { status: 401 });
  const redis = getRedis(), s = sheet();
  if (!redis || !s) return json({ ok: false, error: 'not configured' }, { status: 503 });
  const out = await drain(redis, s, { budgetMs: 25000 });
  const left = await redis.llen(K.pending);
  return json({ ok: true, ...out, stillQueued: left }, { headers: { 'Cache-Control': 'no-store' } });
}
