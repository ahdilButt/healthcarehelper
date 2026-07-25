# RUNBOOK.md — the 150-second demo, click by click

*The acceptance test is SPEC-FINAL §0. This is how you pass it on the day.*

---

## 1. Before the room (30 minutes, day before)

| # | Do | Done when |
|---|---|---|
| 1 | `npm run seed:reset` | prints 14 documents, 48 facts |
| 2 | Open **Today** once in the browser | schedules build themselves; 7 doses appear |
| 3 | `npm run set-phone -- amira@example.com +44…` and again for Dad's sign-in | both print the number back |
| 4 | Set `SMS_DRY_RUN=false` in `.env.local` **and** in Vercel | `npm run tick -- 08:00` sends two real texts |
| 5 | Verify both numbers in the Twilio console (trial accounts only send to verified numbers) | test text arrives on both handsets |
| 6 | `npm run security-check -- https://healthcarehelper-pi.vercel.app` | ALL CHECKS PASS |
| 7 | Install the PWA on both phones (Share → Add to Home Screen) | opens without browser chrome |
| 8 | Record the backup clip: screen-record yourself walking §3 below | file on the desktop, named `backup.mp4` |
| 9 | Rehearse once, with a timer | under 150 seconds |

**Phones.** Phone A is Amira's (yours, mirrored to the projector). Phone B is Dad's — it only has to buzz and show a lock-screen QR. A third device, or Phone B in **incognito**, opens the capsule link as a stranger.

**On the day, immediately before:** `npm run seed:reset` again, open Today once, and open the app on Phone A at the **Timeline** tab.

---

## 2. Keep these open on the desktop

- Tab 1: the app, signed in as Amira.
- Tab 2: `backup.mp4`, paused at frame 0.
- Terminal: `npm run tick -- 08:00` typed but **not** entered.

---

## 3. The script

### 0–40s · The shoebox

1. Phone A, **Timeline** tab. Say: *"This is everything Amira has been sent about her Dad."*
2. Tap **Add a letter** → camera → photograph the printed copy of `demo-data/docs/08-cardiology-letter-12-may.pdf`.
3. The card appears immediately: **"Reading the letter…"**. Let it run — do not tap.
4. It resolves into real cards: **Ramipril dose went up · Ramipril is now 5mg once daily (was 2.5mg once daily)**, an eGFR result, and **This looks overdue**.
5. Tap the **Ramipril dose went up** card. The sheet shows the change, and under *What the letter says here*, the sentence it was read from. Tap **View the original letter**. Close.

> If the photograph fails to read, the card says **Needs a look**. Tap it, tap **Type what it says**, paste two lines, **Send it in**. That path is real and is worth showing if it happens.

### 40–70s · Ask

6. **Ask** tab. Tap the suggestion **"What's actually wrong with Dad's kidneys?"**
7. Read the first two lines out loud. Point at the source chips: *"every answer says which letter it came from."*
8. Tap the chip **from the blood test results · 14 May** → the fact sheet → the line in the letter. Close.
9. Scroll to **Questions you might ask the GP**. Say: *"It never diagnoses. It prepares the conversation."* Point at the line under the input: **Explains and prepares questions — never diagnoses.**

### 70–100s · The daily layer

10. **Today** tab. Seven doses, grouped by part of the day.
11. Tap **Glyceryl trinitrate (GTN) patch**. It ticks green.
12. Scroll to **Where the patch goes** — the last site is marked, the next one pulses. Say: *"It rotates the site, so nobody has to remember."*
13. Press Enter on the waiting terminal command. **Phone B buzzes** with `Dad's 8am medicines: Ramipril 5mg once daily, …`. Hold it up.

### 100–130s · The capsule

14. **Share** tab. Tap **Share with a doctor**.
15. Scroll the preview. Say: *"You see exactly what they will see, before you send it. Anything the system is unsure about is left out."*
16. Tap **Make the share with a doctor link**. The QR appears.
17. Scan it with the **second phone, in incognito**. The clinical page opens: allergies first, then medicines, problems, results, what is in flight. Say: *"No account. No app. She never retells the story again."*
18. Back on Phone A: the link now reads **Opened just now**. Tap **Take it back**, reload the second phone → **This link has been taken back**.

### 130–150s · The thing nobody noticed

19. **Timeline** tab, scroll to June. Tap **This looks overdue — Nephrology referral … appointment date still to be sent**.
20. Tap **Chase this?**. A letter writes itself, with the reference number, the NHS number and the promise the hospital made.
21. Last line: *"That referral went quiet in May. Nobody noticed. That's the one that matters."*

**Finale (stretch lane only, if built):** ring the Twilio number from Dad's phone on speaker and ask it one question. If anything at all is wrong, play `backup.mp4` instead — decide in under two seconds.

---

## 4. If something breaks

| Symptom | Do this |
|---|---|
| Photograph stuck on "Reading the letter…" | leave it; move to Ask and come back. It is one Claude call and finishes. |
| Card lands as **Needs a look** | use it — tap **Type what it says**. It is a real feature, not a failure. |
| Ask is slow | keep talking over it; the answer takes 10–20 seconds and the safety line is on screen meanwhile. |
| No SMS | say the line, show the Today screen, move on. Do not debug on stage. |
| Capsule page will not open | show the preview on Phone A instead — it is the same code path. |
| Anything else | `backup.mp4`. |

---

## 5. What must be true for this to be honest

- Fictional data only. Every artefact footer says so.
- Nothing on screen diagnoses, and nothing advises a change. If a judge asks, the product law is in `lib/constants.ts` and goes into every prompt verbatim.
- Unconfirmed readings never enter a capsule or a text message. The blurry Atorvastatin box is the proof: it is in the timeline, amber, and absent from the doctor brief.

---

## 6. Deploying it

Production is **https://healthcarehelper-pi.vercel.app**, built from the **`master`**
branch. `main` is the design lane and is a different application — if the site
ever shows a page titled "Healthcare Helper - AI Task Automation", Vercel has
reverted to building `main` and nothing below will work.

Vercel → Settings → Git → **Production Branch = `master`**. Changing it does not
move the current deployment: either promote a `master` deployment from the
Deployments list, or push to `master` to build a fresh one.

Environment variables live in Vercel, not in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL   NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY  ANTHROPIC_API_KEY
CRON_SECRET                APP_URL
SMS_DRY_RUN                TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN          TWILIO_FROM_NUMBER
EMAIL_API_KEY
```

Two that bite:

- **`APP_URL`** must be the production URL with no trailing slash. It is encoded
  into every capsule QR code — wrong here and the code you hold up on stage
  points at localhost.
- **Supabase → Authentication → URL Configuration** must list
  `https://healthcarehelper-pi.vercel.app/auth/callback` as a redirect URL, or
  magic-link sign-in fails in production. Keep the localhost one alongside it.

Then `npm run security-check -- https://healthcarehelper-pi.vercel.app`. A healthy
production answers 401 to `/api/persons/…/timeline` and `/api/cron/tick` — a 404
means the wrong branch is live.

## 7. Commands

```
npm run dev                      # local
npm run seed:reset               # rebuild Dad's record from the fixtures
npm run tick -- 08:00            # fire the morning reminder round now
npm run set-phone -- <email> <+44…>
npm run security-check -- <url>  # BUILD-GUIDE §4, run rather than asserted
npm run ask -- "question"        # rehearse an answer without the browser
npm run test:extraction          # the hard gate (real Claude, ~£1–2 a run)
npm run build && npm run lint && npm test
```
