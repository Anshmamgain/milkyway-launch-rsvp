# Milky Way · Launch RSVP

The RSVP for **The MilkyWay Launch**: Fri 16 Oct 2026, 2:45 – 9:30 PM, Auditorium, 8th Floor,
CDS Tower. The launch reveals the dates and vision of Milky Way, Masters' Union's first-ever UG fest.

It is a flow, not a landing page: a five-step RSVP on a living background, ending in a ticket.

1. **Name**: "You're invited. What name goes on your ticket?"
2. **MU email + phone**: only `@mastersunion.org`; the guest types the part before the @
3. **UG batch**: one tap moves on
4. **Friends from MU**: 0–4; every friend is a seat, and the counter never offers more seats than are left
5. **Which world pulls you in** (Imagine / Explore / Create / Connect) + one wish for the fest

Hold to launch → hyperspace → the **ticket**: name, batch, seats, worlds, a scannable QR code
(`MWLAUNCH26|ticketId|email|seats`) for check-in, and a live countdown. The guest can save it as a
1080×1920 image, add the launch to their calendar, send the link to friends, or edit the RSVP.
The browser remembers the RSVP, so returning guests land on their ticket.

Each step has its own background, drawn live on canvas from the brandbook's patterns: spacetime
grid → pulsar → galaxy spiral → aurora field → chromatic dispersion, opening one into the next
through an iris. Typing pulses the pattern; the aurora grows with the crew size.

## Backend

> **Live setup (14 Oct 2026):** Vercel + the Google Sheet through Apps Script, no Redis (the sheet books
> seats under a script lock). Every merge to `main` deploys to production. See `CLAUDE.md` → "Backend: live setup".

```
browser ──▶ Vercel CDN (static site)
        ──▶ /api/seats   edge-cached 10 s ──▶ Upstash Redis (live seat ledger)
        ──▶ /api/rsvp    validate · rate-limit · atomic booking in Redis ──▶ queue
                                                     queue ──▶ Apps Script ──▶ Google Sheet
```

- **Google Sheet "MilkyWay Launch RSVPs"** (milkyway@mastersunion.org's Drive) is the register:
  `Dashboard` (live totals by batch and world), `RSVPs`, `Waitlist`, with a `checkedIn` checkbox for the door.
- **Upstash Redis** books seats in one atomic step, so seat 301 can never be sold and a double-tap never
  double-books. Every RSVP joins a queue that one background writer sends to the sheet in batches of 50.
- **300 seats, friends included.** If a crew no longer fits, the guest is told how many seats are left.
  At zero, RSVPs go to the waitlist. The same email again updates the RSVP, it never duplicates.
- **Only `@mastersunion.org`**, checked in the browser, on the server and in the sheet.
- **Locked down:** only the server can write to the sheet (shared `SHEET_SECRET`). Requests are rate-limited
  per IP and per email, and there's a honeypot for bots.
- **Team edits:** delete a row to free seats, or move a Waitlist row into RSVPs. Then use the sheet menu
  **Milky Way → Sync seats to the site**.

Load-tested with `npm run test:load`, which uses the real handlers, a local Redis and a slow, flaky fake
sheet. In that test 2,000 simultaneous RSVPs gave exactly 300 seats and 1,901 waitlisted, with 0 errors,
and the sheet matched the ledger after the queue drained. Seat-count reads ran at about 4,200/s without the
edge cache (the real site caches them).

### Environment variables (Vercel → Project → Settings → Environment Variables)

| Name | Value |
|---|---|
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Added automatically by Vercel → Storage → Upstash Redis |
| `SHEET_URL` | The Apps Script web-app `/exec` URL |
| `SHEET_SECRET` | A long random string, the same as `SECRET` in the Apps Script |
| `SEAT_CAP` | Optional, defaults to 300 |
| `CRON_SECRET` | Optional, protects the daily `/api/flush` safety net |

## Hosting for free, with no new accounts (GitHub Pages + the sheet)

No Vercel or Redis: the site is static on GitHub Pages and talks straight to the sheet's Apps Script,
which books seats under a script lock (still atomic, 300-seat cap, waitlist, same validation, seat count
cached for 15 s). It handles hundreds of sessions comfortably. At the very peak, RSVPs queue for a few
seconds and the button reads "In the queue".

1. In the sheet: Extensions → Apps Script, paste `docs/apps-script.gs`, then Deploy → Web app
   (Execute as: Me, Who has access: Anyone). Copy the `/exec` URL.
2. `npm run build:pages`, then upload everything inside `dist/` to a **public** GitHub repo named
   `<username>.github.io`. GitHub serves it at `https://<username>.github.io` within a minute.
3. On GitHub, edit `env.js` and paste the `/exec` URL between the quotes. Until then the site runs as a
   preview with a red "Preview · RSVPs are not saved yet" label.

## Run it

```bash
npm install
npm run dev         # front end at http://localhost:5173 (use `vercel dev` to run the API locally too)
npm run build       # production build (deploys to Vercel as-is)
npm run build:demo  # preview build that keeps RSVPs in the browser only
npm run test:load   # load test (needs redis-server on port 6390)
```

## Built with

Vite + vanilla JS · Vercel Functions · Upstash Redis · Google Sheets via Apps Script · GSAP (step and ticket choreography) · StringTune (magnetic buttons, tilting ticket
with a holographic sheen) · Canvas 2D (pattern engine, hyperspace, ticket image) · qrcode-generator.
Logos, symbols and mascot cut-outs are taken from the Visual Branding Book 2027.

## Please confirm

- Batch options are "First year" to "Fourth year". Swap in your real batch names if they differ.
- Max 4 friends per RSVP (`MAX_CREW` in `src/config.js`).
