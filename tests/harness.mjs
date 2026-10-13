// Runs the real api/ handlers on a local server, with a local Redis (through an Upstash-shaped
// adapter) and a fake Google Sheet that is deliberately slow and flaky, like Apps Script under load.
import http from 'node:http';
import IORedis from 'ioredis';
import { __setTestDeps } from '../api/_lib/deps.js';
import * as seats from '../api/seats.js';
import * as rsvp from '../api/rsvp.js';
import * as flush from '../api/flush.js';
import * as sync from '../api/admin-sync.js';

export function upstashLike(io) {
  return {
    get: (k) => io.get(k), set: (k, v, o) => (o?.nx ? io.set(k, v, 'EX', o.ex || 30, 'NX') : io.set(k, v)),
    lrange: (k, a, b) => io.lrange(k, a, b), ltrim: (k, a, b) => io.ltrim(k, a, b), incr: (k) => io.incr(k), expire: (k, s) => io.expire(k, s),
    rpush: (k, v) => io.rpush(k, v), lpush: (k, v) => io.lpush(k, v), lpop: (k) => io.lpop(k), llen: (k) => io.llen(k),
    eval: (script, keys, args) => io.eval(script, keys.length, ...keys, ...args),
  };
}

export function fakeSheet({ minMs = 400, maxMs = 1200, failRate = 0.15, maxConcurrent = 8 } = {}) {
  const tables = { RSVPs: new Map(), Waitlist: new Map() };
  let inflight = 0; const stats = { calls: 0, failures: 0, busy: 0 };
  const fn = async (job) => {
    stats.calls++;
    if (inflight >= maxConcurrent) { stats.busy++; throw new Error('busy'); }
    inflight++;
    try {
      await new Promise((r) => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));
      if (Math.random() < failRate) { stats.failures++; throw new Error('Service invoked too many times'); }
      const jobs = job.action === 'upsertMany' ? job.jobs : job.action === 'upsert' ? [job] : [];
      for (const j of jobs) {
        const other = j.table === 'RSVPs' ? 'Waitlist' : 'RSVPs';
        tables[other].delete(j.row.email); tables[j.table].set(j.row.email, j.row);
      }
      return { ok: true };
    } finally { inflight--; }
  };
  return { fn, tables, stats };
}

const routes = { '/api/seats': seats, '/api/rsvp': rsvp, '/api/flush': flush, '/api/admin-sync': sync };

export async function start({ port = 8790, sheetOpts } = {}) {
  process.env.SHEET_SECRET = 'test-secret';
  delete process.env.CRON_SECRET;
  const io = new IORedis({ port: 6390, lazyConnect: false });
  await io.flushdb();
  const sheet = fakeSheet(sheetOpts);
  __setTestDeps(upstashLike(io), sheet.fn);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const mod = routes[url.pathname];
    const handler = mod?.[req.method];
    if (!handler) { res.writeHead(404); return res.end(); }
    const chunks = []; for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const out = await handler(request);
    res.writeHead(out.status, Object.fromEntries(out.headers));
    res.end(Buffer.from(await out.arrayBuffer()));
  });
  await new Promise((r) => server.listen(port, r));
  return { io, sheet, server, close: async () => { server.close(); await io.quit(); } };
}
