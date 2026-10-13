# MilkyWay Launch RSVP: project context

Read this first. It is the handover from the build session: what this is, what was decided, what is
live, and what is left. The full history is in `docs/SESSION_LOG.md`. The brand sources (brandbook PDF,
reference video of the old invite, poster) are in `brand/`.

## What it is

The RSVP site for **The MilkyWay Launch**, Fri 16 Oct 2026, 2:45 – 9:30 PM, Auditorium, 8th Floor, CDS
Tower, Masters' Union (Gurugram). At the launch, the team reveals the dates and vision of **Milky Way**,
Masters' Union's first-ever UG fest. Organiser contact: milkyway@mastersunion.org.

## Decisions the client made (do not undo without asking)

- **Flow only, no landing page.** The site opens straight into a 5-step RSVP and ends with a ticket.
- **MU UG students only**: `@mastersunion.org` emails. The user types the part before the @.
- **300 seats, friends count as seats** (max 4 friends per RSVP), **waitlist when full**. The same email
  updates its RSVP; it never duplicates.
- **Do not show the main fest's dates** (they are revealed at the launch). The fest is only "Milky Way 2027".
- **No volunteer question** in the RSVP. Volunteer sign-ups are a separate form after the launch.
- **Hosting (14 Oct 2026)**: Snowball runs it. Site and `/api` on Vercel (Ansh's account), RSVPs in a Google
  Sheet on ansh@thesnowball.cc written by an Apps Script web app. The sheet is shared with
  milkyway@mastersunion.org. No Redis: the sheet books seats under the script lock.
- **Motion- and interaction-heavy**, true to the brandbook. The client asked for "extremely good".

## The flow (index.html, src/)

Countdown loader → 1 Name ("You're invited.") → 2 MU email + phone → 3 UG batch (Year 1–4, one tap
advances) → 4 friends from MU (0–4, capped by seats left) → 5 which world pulls you in (Imagine / Explore
/ Create / Connect) plus one wish → **hold to launch** (1.1 s, or hold Space) → hyperspace → **ticket**.

- Background: `src/js/scene.js`, one canvas that morphs through the brandbook patterns, one per step
  (spacetime grid → pulsar → galaxy spiral → aurora field → chromatic dispersion → calm starfield for
  the ticket). Transitions are an iris. It reacts to typing (`pulse`) and crew size (`setLevel`).
  The step's accent colour drives `--acc` via `data-mode` on `<html>`.
- Mascot (astronaut cut-outs from the brandbook) perches on the card corner and changes pose per step.
- Ticket: QR code (`MWLAUNCH26|ticketId|email|seats`, generated with qrcode-generator) for door
  check-in, live countdown, holographic sheen on tilt (StringTune `tilt`), "Save ticket" exports
  1080×1920 PNG (`src/js/pass.js`), .ics (`src/js/ics.js`), share, edit. The RSVP is remembered in
  localStorage, so returning visitors land on their ticket.
- Questions sheet (FAQ) from the top bar. Live seat counter in the top bar.

## Brand (Visual Branding Book 2027, chapter 04)

Colours: Void Black #000621, Deep Space Blue #182276, Cosmic Blue #506CD9, Orbit Red #D13F30, Nebula
Pink #F6AAC8, Kiwi Green #4DAA48, UFO Green #22D974, Bright Goldenrod #EAD11F, Cream #FFE3C5, Moonlight
#F7F7F5. Type: **Bricolage Grotesque Condensed** (display, `font-stretch: 75%`, 800) and **Mozilla
Headline** (text), both from Google Fonts. Logos, primary symbols (Imagine eye, Explore star, Create
bolt, Connect asterisk), communication and universe symbols are vector paths extracted from the PDF into
`src/svg/`, inlined with `data-svg="name"`. Mascot images are in `public/assets/img/`.
The brandbook PDF, the reference video and the poster are in `brand/`.

## Backend: live setup (14 Oct 2026)

```
browser ──▶ Vercel (static site)
        ──▶ /api/seats   edge-cached 10 s ──▶ Apps Script (status, with secret) ──▶ Sheet
        ──▶ /api/rsvp    validate ──▶ Apps Script (reserve, with secret, under LockService) ──▶ Sheet
```

- **Repo**: github.com/Anshmamgain/milkyway-launch-rsvp (public, so Vercel's Hobby plan deploys
  commits from collaborators; a private repo on Hobby blocks every commit not authored by Ansh).
- **Vercel**: project `milkyway-launch` on Ansh's account, Git-connected. Every push or merge to `main`
  deploys to production; other branches and PRs get preview URLs. Nobody else needs Vercel access.
- **Env vars** (Vercel → Settings → Environment Variables): `SHEET_URL` (Apps Script /exec URL),
  `SHEET_SECRET` (same value as `SECRET` in the deployed script), `SEAT_CAP` (300). No Upstash vars,
  so `api/rsvp.js` takes its "no Redis" branch and the sheet does the atomic booking.
- **Sheet**: "MilkyWay Launch RSVPs" on ansh@thesnowball.cc, tabs Dashboard (live formulas), RSVPs,
  Waitlist. Columns: `submittedAt, ticketId, name, email, phone, batch, crew, seats, friends, worlds,
  wish, status, checkedIn, page`. `checkedIn` is a checkbox for the door.
- **Apps Script**: standalone project "MilkyWay Launch RSVP backend" on ansh@thesnowball.cc, with
  `SHEET_ID` set. The deployed copy holds the real `SECRET`; the copy in `docs/apps-script.gs` keeps the
  placeholder, so never commit the real one. After editing the script: Deploy → Manage deployments →
  Edit → Version: New version (the URL stays the same).
- **Team edits**: delete a row in RSVPs to free its seats, or move a Waitlist row into RSVPs. The seat
  count is read live from the sheet, so the site shows it within ~10 s. The sheet menu does not exist
  (standalone script), and it is not needed.
- The old GitHub Pages build (milkyway2027.github.io) and the copy of the sheet on the client's Gmail are
  retired. Point every link at the Vercel URL.

## Alternative backend (optional): Upstash Redis

Add Upstash Redis to the Vercel project and `api/` switches to Redis booking automatically (`RESERVE_LUA`
in `api/_lib/core.js`), with a single drainer writing batches of 50 to the sheet through Apps Script
`upsertMany`. Load test: `npm run test:load` (needs `redis-server --port 6390`): 2,000 concurrent RSVPs
gave exactly 300 seats and 0 errors. Not needed at ~700 sessions.

## Commands

```bash
npm install
npm run dev           # front end, http://localhost:5173 (preview mode unless VITE_API_BASE is set)
npm run build         # Vercel build (uses /api)
npm run build:pages   # GitHub Pages build (reads env.js at runtime)
npm run build:demo    # preview-only build
npm run test:load     # Vercel backend load test
```

## Code map

- `index.html`: all markup (loader, bar, card with 5 fieldsets, ticket, FAQ sheet)
- `src/main.js`: boot (StringTune magnetic + tilt, scene, cursor, FAQ, seats, RSVP)
- `src/js/rsvp.js`: steps, validation, crew, hold-to-launch, send/retry, ticket, warp, confetti
- `src/js/scene.js`: canvas pattern engine · `src/js/seats.js`: live seat state + polling
- `src/js/pass.js`: ticket PNG · `src/js/ics.js` · `src/js/faq.js` · `src/js/intro.js` (loader) · `src/js/cursor.js` · `src/js/svg.js`
- `src/styles.css`: all styles (tokens at the top) · `src/config.js`: API/demo switches, event data, caps
- `docs/apps-script.gs`: sheet backend · `docs/FLOW.md`: flow analysis and rationale
- `api/`: optional Vercel backend · `tests/`: load-test harness
