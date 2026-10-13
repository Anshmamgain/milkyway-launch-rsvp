# Build session log

A chronological record of the Claude Code session that built this project (13–14 Oct 2026): what the
client asked for, what was built, what changed, and why. `CLAUDE.md` is the current-state summary;
this file is the history behind it.

## 1. The brief

The client (Milky Way team, Masters' Union) shared:
- the poster key visual (`brand/key-visual-poster.jpg`),
- the Visual Branding Book 2027 (`brand/milkyway-brandbook-2027.pdf`),
- a screen recording of their existing invite (`brand/reference-invite-flow.mp4`),
- their current site, milkyway-registration.vercel.app, as the reference for copy and flow,
- four references to apply: the taste-skill repo (Leonxlnx/taste-skill), awesome-design-md
  (VoltAgent), prompt-motion.com and StringTune (string-tune.fiddle.digital).

Ask: a university-fest RSVP site that is "significantly motion and interaction heavy while feeling
cool", "a graphical and interaction marvel", plus a reverse-engineered flow and a better one.

Constraints discovered:
- The build environment's network policy blocked milkyway-registration.vercel.app,
  string-tune.fiddle.digital and prompt-motion.com, and a browser recording was blocked the same way.
  The flow was reverse-engineered from the recording; StringTune was used from npm by reading its
  source (attribute API: `string="progress|parallax|magnetic|tilt|marquee|split"`, CSS vars
  `--progress`, `--tilt-x/y`, `--magnetic-x/y`).
- taste-skill was cloned and its rules applied: one signature motion moment, choreographed entrances,
  no generic AI tells, the idea taken from the subject. Here: "the airmail invite becomes a launch."

## 2. Reverse-engineered original flow (from the video)

Closed airmail envelope → flap opens → poster card ("masters' union presents MILKY WAY · See you
there!") slides up → "YOU'RE INVITED." → stamp + postmark → static card with From: The MilkyWay Team /
To: You. (Bring your friends.) / Date Fri 16 Oct / Time 2:45 – 9:30 PM / Venue Auditorium, 8th Floor,
CDS Tower / RSVP NOW / milkyway@mastersunion.org.
Gaps: passive (watched, not done), "come shape it from day one" not acted on, "bring your friends" with
no mechanism, a dead end after RSVP, the brand barely used. Full write-up: `docs/FLOW.md`.

## 3. Asset extraction from the brandbook PDF

- `pdfimages` with alpha masks merged: mascot pose sheet (cut into 6 poses with connected-component
  cleanup), dab and DJ poses, patches, chest plate, India "Road to Milky Way" photos, key visual.
- `pdftocairo -svg` on the logo, icon and symbol pages, then clustering of filled paths into
  individual SVGs: MILKY WAY wordmark, extruded 3D logo, Masters' Union logo, PRESENTS banner,
  4 primary symbols, communication symbols, event-space symbols, 12 universe symbols, patterns.

## 4. Version 1: long scrolling landing page (superseded)

Countdown preloader; interactive envelope (break the seal, 3D flap, poster rises, stamped headline,
stamp and postmark slam, mascot entrance); scroll story (manifesto lighting word by word, four worlds,
flight-plan boarding pass with countdown, fest teaser, draggable "Road to Milky Way" strip, FAQ, "See
you there!"); Mission Control RSVP overlay with a live ticket preview and hold-to-launch. Published as
a private claude.ai artifact for preview.

Client corrections along the way:
- "This is just the launch: we reveal the main event's dates and the vision." → main-fest dates
  removed and shown only as a scrambling "classified" block.
- A volunteer question was briefly added, then removed: "volunteering is a separate form after the
  event."

## 5. Version 2: screen-by-screen app

Client: "this is supposed to be a flow webapp rather than a direct landing page" and "invites are
capped at 300, live updated." Rebuilt as screens (invite → story → RSVP → ticket) with a Google Sheet
backend, a live seat counter and a waitlist.

Answers from the client: Google Sheet backend; every seat counts, including friends; waitlist when full.

## 6. Version 3: pure RSVP flow (current)

Client: "only MU UG emails with @mastersunion.org", "the flow should be first and only, with better
background motion graphics, no landing page, just the flow and the ticket at the end", "the ticket can
look way cleaner and better", "make it look extremely good".

Built:
- a 5-step card flow on a canvas background that morphs through the brandbook patterns per step;
- MU-only email with a fixed suffix;
- batch chips; friends counter capped by seats left;
- worlds + wish; hold to launch; hyperspace;
- a redesigned ticket with QR check-in, countdown and holographic tilt, plus a 1080×1920 PNG export.

## 7. Backend iterations

1. Apps Script reserve with LockService, tested in a Node vm with mocks: cap, too_many, waitlist,
   dedupe, gmail rejected.
2. Client: "connect a real sheet and lock it in, host on Vercel, thousands of sessions." Created the real
   sheet via the Google connector (milkyway@mastersunion.org Drive, id
   1IWmywoWtDjR8PTvFY7x4IAfXX87EiEODnZZOBERVohg) with Dashboard, RSVPs and Waitlist tabs. Built `api/`
   (Vercel functions + Upstash Redis atomic Lua booking + single-drainer batched sheet writes + edge-cached
   seat count + rate limits + honeypot). The load test first exposed per-request sheet writes
   (4,000 calls, slow drain), fixed with batching: 2,000 concurrent RSVPs → exactly 300 seats, 0 errors,
   sheet = ledger. Vercel was not connected to the session (no account; api.vercel.com blocked).
   Client later clarified: at most about 700 sessions.
3. Client: "host it anywhere free without explicit login." Moved to GitHub Pages plus Apps Script
   directly: public cached `?action=status` and `action=rsvp` endpoints in the script, client Apps
   Script mode, retry/queue, preview label. The session's GitHub integration (milkyway2027) could not
   create repos (403), and the client's personal GitHub wasn't connected. So the build is a zip the
   client uploads to `<username>.github.io`, with the sheet URL in a runtime `env.js` (no rebuild needed).
4. Apps Script is **disabled on the mastersunion.org Workspace.** The sheet was shared with personal
   Gmail accounts, and the client made a copy
   "MilkyWay's Launch RSVPs" in the personal account. Opening Apps Script showed "Sorry, unable to open
   the file at present", the multi-account bug. The fix is a private window with only the personal
   account, or a standalone project at script.google.com with `SHEET_ID` set (added to the script).

## 8. Where it stopped

The client's public GitHub Pages repo is up (preview mode). Next: deploy the Apps Script from the
personal account, check `?action=status`, paste the `/exec` URL into `env.js`, test one RSVP, share the
live sheet with milkyway@mastersunion.org. See "Left to do" in `CLAUDE.md`.

## 9. Moved to Snowball's stack (14 Oct 2026)

Apps Script was still blocked on both client accounts two days before the launch, so Snowball took
over hosting: a fresh sheet and a standalone Apps Script on ansh@thesnowball.cc (created through the
Drive API), the site and `/api` on Vercel, the repo on Ansh's GitHub with the client as a collaborator.
The repo is public because Vercel's Hobby plan blocks collaborator commits on private repos. Two code
changes: the Vercel no-Redis path now passes a `too_many` answer back to the browser instead of retrying
it as an error, and new rows get a real checkbox in `checkedIn`. See "Backend: live setup" in `CLAUDE.md`.

## Things to know before changing anything

- Event facts live in `src/config.js` (EVENT) and in copy in `index.html`; the main fest's dates must not
  appear anywhere.
- `SEAT_CAP` (300) lives in three places: `src/config.js`, `docs/apps-script.gs` `CAP`, and the `api/`
  env var. Keep them equal.
- The Apps Script must be redeployed as a **new version** after edits (Manage deployments → Edit) to keep
  the same URL.
- The preview artifact (claude.ai/artifact/WXHX5Bj5XfEsHEYY4w5uoC) is private to the client's account.
