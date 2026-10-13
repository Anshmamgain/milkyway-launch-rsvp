# RSVP flow: what exists, and what this site does instead

## 1. The current flow, reverse-engineered

Source: the screen recording of the current invite (`milkyway-registration.vercel.app`). The live site
itself could not be opened from the build environment (its network policy blocks the host), so this is
read from the recording, frame by frame.

| # | What happens | Copy on screen |
|---|---|---|
| 1 | A closed airmail envelope sits on black. Navy flap, red wax seal with a star. | From: The MilkyWay Team, Masters' Union University · To: You. (Bring your friends.) · THE MILKYWAY LAUNCH |
| 2 | The flap disappears (no hinge motion), the envelope front stays. | Masters' Union's first-ever UG fest. Come shape it from day one. |
| 3 | A poster card slides up out of the envelope. | masters' union university PRESENTS · MILKY WAY · See you there! |
| 4 | The headline appears. | YOU'RE INVITED. |
| 5 | A postage stamp, then a postmark, drop onto the corner. | 16 OCT 2026 · MILKYWAY · 2026 |
| 6 | Static from here. One button. | DATE Fri, 16 Oct · TIME 2:45 – 9:30 PM · VENUE Auditorium, 8th Floor, CDS Tower · RSVP NOW → · milkyway@mastersunion.org |

**What works:** the airmail-invitation idea is right for an invite. The copy is short and warm ("Bring your
friends."). Everything a guest needs (date, time, place) is on one card.

**Where it leaks:**

1. **It plays to you, it doesn't involve you.** The opening is a 6-second video you watch. Nothing
   happens because of something you did.
2. **The best line is never used.** "Come shape it from day one" is the reason to come, but nothing
   after the card lets you shape anything. RSVP is just a name collector.
3. **"Bring your friends" is a promise with no mechanism.** You can't say how many are coming, so the
   team can't plan seats, and friends never receive an invitation.
4. **The ending is a dead end.** After RSVP there is nothing to keep, save or share. No calendar entry,
   no proof of RSVP, no reason to come back.
5. **The brand is barely there.** The brandbook has a mascot, four primary symbols, patterns, a voice
   (bold, curious, cool) and a whole "Road to Milky Way" world. The flow uses the logo and two colours.
6. **No sense of time or stakes.** Nothing tells you how close the launch is, or that something
   (the dates, the vision) is being revealed only to the people in the room.

## 2. The flow as built

Decided with the team: no landing page. The site *is* the RSVP flow, and it ends with a ticket.
RSVP is open to Masters' Union UG students only (`@mastersunion.org`), capped at 300 seats with friends
counting as seats, with a waitlist when it fills. Volunteer sign-ups are a separate form after the launch.

```
Countdown (1.5 s) → Name → MU email + phone → Batch → Friends → World → Hold to launch → Ticket
```

| Step | What changes | Background pattern |
|---|---|---|
| Name | "You're invited." opens the question; the event line and live seat count sit above it | Spacetime grid, pulled toward the cursor; typing sends ripples |
| MU email | Only the part before `@mastersunion.org` is typed; pasting a full address strips the domain; other domains are refused | Pulsar, the core swells with each keystroke |
| Batch | One tap answers and moves on | Galaxy spiral of shards |
| Friends | 0–4, never more than the seats left; optional names | Aurora field, which grows with the crew |
| World | Four brand worlds + one wish | Chromatic dispersion streaming in |
| Launch | Press and hold 1.1 s (or Space); release to cancel | Hyperspace |
| Ticket | Pass with QR for check-in, live countdown, save as image, calendar, share, edit | Calm starfield under slow rays |

Data per RSVP: `ticketId, name, email, phone, batch, crew, seats, friends[], worlds[], wish, submittedAt, page`.
