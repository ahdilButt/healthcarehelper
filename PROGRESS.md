# PROGRESS.md — Aftercare (works-lane)

*Resume a fresh session with: **"Read CLAUDE.md and PROGRESS.md, continue autopilot."***

The product is now called **Aftercare**. The repo, package and internal docs still
say `healthcarehelper` — renaming the repository would break the Vercel
connection, so that stays until after the demo.

**Live: https://healthcarehelper-pi.vercel.app** — built from `master`, all
eleven stages shipped, 46 commits.

---

## 1. Read this before touching anything

| Fact | Value |
|---|---|
| Production URL | `https://healthcarehelper-pi.vercel.app` |
| Production branch | `master` (NOT `main` — see §6) |
| Repo | `github.com/ahdilButt/healthcarehelper` |
| Vercel scope/project | `healthcarehelper / healthcarehelper` |
| Deploys on | every push to `master`, automatically |
| Sign-in that works, with full data | `acadahdil998@gmail.com` |
| Sign-in that works, blank | `dad@example.com` (mint a link — not a real inbox) |

`main` is the design lane's branch and is a **different application**. If the
site ever shows a page titled "Healthcare Helper - AI Task Automation",
production has reverted to `main`.

---

## 2. Where the build is

Every stage in CLAUDE.md's AUTOPILOT list is done and deployed.

| Stage | Evidence |
|---|---|
| 0 Dataset | `npm run validate:dataset` — 15 artefacts / 15 fixtures / 71 facts |
| 1 Scaffold | builds clean |
| 2 Seed | `npm run seed:reset` |
| 3 Auth, persons, invites | magic link, sign-out, invite links, onboarding guard |
| 4 Ingest | `npm run test:extraction` — 15/15 documents, 71 checks |
| 5 Narration / needs-a-look / merge | processing card, type-it-in, retake, merge prompt survives reload |
| 6 Timeline + corrections | 6 card variants, Fix this, view original |
| 7 Ask + translate | cited answers, GP questions, honest not-in-record |
| 8 Routines / Today / SMS / cron | schedules, patch rotation, tick idempotent |
| 9 Capsules + `/c/[token]` | 3 presets verified with curl, revoked → 410 |
| 10 Watch-cards + Chase this | drafts a letter carrying the real reference number |
| 11 M3 self-test | wiped, re-ingested live, 4 defects found and fixed |

**Beyond the original spec, added since:** voice-note recording, an
ElevenLabs voice, Ask-as-a-call, the Today brief panel, the Aftercare rename,
the v0 design-lane integration, invites, sign-out, "Add someone else".

---

## 3. What is left — the actual next job

The user's words: *"turn this site into a deployed website — just a playable
demo… let those who use it upload and talk to it… then cut off all access in
3–7 days… and cap the credits."*

### 3a. Public demo mode
Currently every route needs a sign-in. A stranger from social media cannot
play. Decide and build one of:
- **Guest mode** — a "Try it" button that creates a throwaway person + session,
  seeded with the demo record so there is something to talk to.
- **Shared demo account** — one pre-made login behind a link. Simpler; everyone
  writes into the same record, which will get messy fast.

Guest mode is the honest one. It needs: a route that provisions an anonymous
Supabase user (Supabase supports anonymous sign-ins), copies the seed record
for them, and an expiry.

### 3b. Kill switch (3–7 days)
**Recommended: an env var, checked in `proxy.ts`.**
```
DEMO_CLOSES_AT=2026-08-02T18:00:00Z
```
`proxy.ts` already runs on every request. If the date has passed, rewrite
everything except a static `/closed` page. No cron, no external service, and
reversible by editing one Vercel variable. Add a banner counting down while
it is still open.

Belt and braces: `POST /api/cron/tick` already runs every minute — have it
email/SMS the owner 24 hours before the date.

### 3c. Credit caps
Both AI paths need a ceiling, and neither has one:
- **ElevenLabs** — user asked for ~5000 characters. `/api/speech` caps a single
  request at 700 chars but nothing tracks the total.
- **Anthropic** — `/api/ask`, `/brief`, `/translate`, `/chase` and the ingest
  pipeline all spend, uncapped.

Serverless means in-memory counters do not survive. Needs a small table
(a new table is an addition, not a contract change):
```sql
create table usage_counters (
  key text primary key,        -- 'elevenlabs:chars', 'anthropic:calls'
  used bigint not null default 0,
  updated_at timestamptz not null default now()
);
```
Increment before spending, refuse over budget, and fall back gracefully —
`useSpeech` already falls back to the browser voice, so a spent voice budget
degrades rather than breaks.

### 3d. Smaller, known, unfixed
- **Conditions extract noisily** — 15 rows where DATASET-BIBLE says 4. Symptoms
  ("Breathlessness on exertion") and echo findings are recorded as conditions.
  A Stage B prompt tightening plus a fixture. Most visible on the doctor brief.
- **"See the demo story"** should be a 3–5 screen guided tour per
  ONBOARDING-PAGE-SPEC. It currently goes straight to the timeline.
- **No delete** — a document can be merged away but never removed, and there is
  no account deletion. Fine for a demo, not for real users.
- **`public/healthcare-helper-logo.png`** is now unused (the lockup is text).

---

## 4. Flags — things that will bite

1. **The service-role key is in `main`'s git history** (`demo-data/.env.local`,
   commit `0c90373`). It bypasses every RLS policy. **Rotate before any real
   user touches this.** Not a demo blocker; is a real-users blocker.
2. **One Supabase project is shared with the design lane.** Their seed writes
   into the demo record — 12 `placeholder.pdf` documents appeared mid-ingest
   once. Separate projects before it matters.
3. **Resend has no verified domain** (unconfirmed but likely). Consequence:
   auth email reaches `acadahdil998@gmail.com` only. Everyone else needs a
   minted link. Fix: Resend → Domains → add one + DNS.
4. **`EMAIL_API_KEY` is in `.env.local` but NOT in Vercel** — production cannot
   send reminder emails until it is added.
5. **`SMS_DRY_RUN=true`.** Twilio credentials are filled; flip to `false` for
   real texts. Phone numbers live on `auth.users.user_metadata` via
   `npm run set-phone` because the frozen schema has no phone column.
6. **pg_cron is not scheduled.** Snippet at the bottom of `supabase/schema.sql`.
7. **A magic link IS a credential.** Opening one signs you in AS that account —
   it does not grant access, it transfers identity. This caused a developer to
   see the owner's record. `npm run magic-link` now refuses to guess an address
   when targeting production.
8. **Form links vs minted links.** A link from the sign-in form must be opened
   in the browser that requested it (PKCE). A link from `npm run magic-link`
   works on any device. Use the latter for anyone else's phone.
9. **Routes added beyond the frozen contract** (additions, no signature moved):
   `POST /api/documents/:id/transcript`, `GET /api/persons/:id/duplicates`,
   `GET /api/loops/:id/chase`, `PATCH /api/persons/:id`, `POST /api/speech`,
   `GET /api/today/:personId/brief`.

---

## 5. Accounts and data, as they stand

| Email | Sees |
|---|---|
| `acadahdil998@gmail.com` | **Dad — 20 docs, 7 meds** (owner) · Test record (1 letter) |
| `amira@example.com` | Dad, the same full record (owner) |
| `zjm990826@gmail.com` | Dad (carer) · Test record (0 letters) |
| `demo@livingrecord.app` | Amira (empty) · a different Dad, 12 docs — design lane |
| `dad@example.com` | nothing — lands on onboarding |

The demo record is **"Dad"**; the near-empty ones are renamed
**"Test record (n letters)"** so the switcher is unambiguous on stage.

Its medicines were corrected by hand to DATASET-BIBLE §4 (Ramipril 5mg,
Bisoprolol 2.5mg, Furosemide 40mg, Metformin 1g bd, Atorvastatin 20mg nocte,
GTN patch, Amlodipine stopped) because those rows were ingested *before*
`richerDose` learned to prefer "once daily" over "quantity 28". The extraction
code is correct now; a fresh ingest produces the right values.

`npm run demo:appt` puts the eye screening two days out — **re-run it on the
morning of the demo** or the diary line reads "no appointments".

---

## 6. Deploying — the thing that cost an afternoon

The production branch setting is **Settings → Environments → Production →
Branch Tracking**, NOT the Git page. While it read `main`, every push to
`master` built cleanly and parked itself as a *Preview*, and production only
moved when a deployment was promoted by hand. That looks exactly like a broken
deploy. It now reads `master`.

**Do not poll the production URL in a loop.** Vercel answers automated traffic
with `x-vercel-mitigated: challenge`, a JS checkpoint curl cannot pass. It
looks like an outage and is not one. Browsers are unaffected — but
`npm run security-check` against production will fail spuriously afterwards.

---

## 7. Commands

```
npm run dev
npm run build && npm run lint && npm run typecheck && npm test   # the gates

npm run magic-link -- someone@example.com --prod   # sign-in link, no email, any device
npm run set-phone -- <email> <+44…>
npm run demo:appt            # eye screening 2 days out · `-- 0` for today
npm run tick -- 08:00        # one minute of cron, at a time you choose
npm run security-check -- https://healthcarehelper-pi.vercel.app
npm run ask -- "question"    # the Ask brain without a browser

npm run seed:reset           # rebuild Dad from fixtures
npm run wipe -- --yes-really # empty everything (destructive)
npm run ingest               # 15 artefacts through the real pipeline (~£1–2, 8 min)
npm run test:extraction      # the hard gate (~£1–2)
```

---

## 8. Decisions worth knowing before you change anything

**Every surface reads facts through `lib/facts/read.ts`.** Timeline, Today, Ask
and capsules all apply the correction overlay, so a fix made once cannot be
missing anywhere else. Add a surface, use this file.

**Correcting a fact clears its amber; confirming does not move a dose.**
Someone typing a value is the human check the badge was asking for. But a
one-tap *confirm* only clears the badge — `write-facts.ts` refuses to let an
unconfirmed reading rewrite a live dose, precisely so a blurred box cannot
become a treatment change, and confirm must not be the back door into it.

**Unconfirmed facts cannot move a dose, enter a capsule, or send a text.**
Three separate code paths enforce the same threshold.

**The seed and the pipeline share one writer** (`writeFacts`). Do not add a
second write path.

**Spoken answers are written for the ear, not trimmed.** `/api/ask` takes a
`spoken` flag; the brain then answers in the first sentence, under 35 words,
one short citation. Truncating a written answer is not the same thing.

**Wall-clock times resolve through Europe/London properly** — "08:00" still
means eight in the morning after the clocks change. Tested both sides of March.

**Dead capsule links answer 410.** A rendered page cannot set its own status,
so `/c/[token]` redirects to `/c/gone`, which carries its own markup.

**The design lane's tokens and mine are the same hex values** under different
names; `globals.css` aliases theirs onto `--hh-*`. There are now two primitive
files — `components/ui-bits.tsx` (theirs) and `components/ui/primitives.tsx`
(mine). **Decide which survives** before they diverge further.

---

## 9. Process notes for whoever picks this up

- **Never build file content with shell string-replacement.** Backticks inside
  a bash string execute. This pasted a live magic-link token into RUNBOOK.md
  once (consumed and removed, commit `bdfe2aa`) and mangled a component three
  times. Use the file editor.
- **Opus 5 with a small `max_tokens` can spend it all reasoning** and return an
  empty text block, which looks identical to an API failure. `lib/routines/brief.ts`
  sets `effort: 'low'` and a real budget for this reason.
- **A silent fallback needs a log line** or the broken path looks exactly like
  the working one.
- Gates run before every commit; commit messages carry the reasoning.

---

## 10. Cost note

`npm run test:extraction` and `npm run ingest` each run real Claude vision over
15 artefacts (~£1–2). Ask, brief, translate and chase are pennies each.
ElevenLabs bills per character — see §3c, it is currently uncapped.
