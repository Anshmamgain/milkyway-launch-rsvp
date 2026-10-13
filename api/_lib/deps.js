import { Redis } from '@upstash/redis';
import { sheetClient } from './core.js';

// Environment, read once per cold start.
//   UPSTASH_REDIS_REST_URL / _TOKEN  (or KV_REST_API_URL / _TOKEN): added by Vercel's Upstash integration
//   SHEET_URL     Apps Script web-app /exec URL
//   SHEET_SECRET  shared secret, same value as SECRET in the Apps Script
//   SEAT_CAP      300 by default
export const CAP = Number(process.env.SEAT_CAP) || 300;

let redis = null;
export function getRedis() {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token, automaticDeserialization: false, retry: { retries: 3, backoff: (n) => 50 * 2 ** n } });
  return redis;
}

export function getSheet() {
  if (!process.env.SHEET_URL || !process.env.SHEET_SECRET) return null;
  return sheetClient(process.env.SHEET_URL, process.env.SHEET_SECRET);
}

// Tests swap in a local Redis and a fake sheet.
export function __setTestDeps(r, s) { redis = r; sheetOverride = s; }
let sheetOverride = null;
export const sheet = () => sheetOverride || getSheet();
