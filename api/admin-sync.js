import { syncFromSheet, drain, json } from './_lib/core.js';
import { getRedis, sheet } from './_lib/deps.js';

// POST /api/admin-sync: called from the sheet's "Milky Way → Sync seats to the site" menu after
// the team deletes rows or moves people off the waitlist. Rebuilds the live ledger from the sheet.
export async function POST(request) {
  let body; try { body = JSON.parse(await request.text()); } catch { return json({ ok: false }, { status: 400 }); }
  if (!process.env.SHEET_SECRET || body.secret !== process.env.SHEET_SECRET) return json({ ok: false, error: 'Wrong secret.' }, { status: 401 });
  const redis = getRedis();
  if (!redis) return json({ ok: false, error: 'Redis is not configured, nothing to sync.' }, { status: 400 });
  const s = sheet();
  if (s) await drain(redis, s, { budgetMs: 15000 }); // get queued rows into the sheet first
  const out = await syncFromSheet(redis, { rsvps: body.rsvps || [], waitlist: body.waitlist || [] });
  return json({ ok: true, ...out }, { headers: { 'Cache-Control': 'no-store' } });
}
