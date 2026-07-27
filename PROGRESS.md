# PROGRESS.md — Aftercare (works-lane)

*Resume a fresh session with: **"Read CLAUDE.md and PROGRESS.md, continue autopilot."***

The product is now called **Aftercare**. The repo, package and internal docs still
say `healthcarehelper` — renaming the repository would break the Vercel
connection, so that stays until after the demo.

**Live: https://healthcarehelper-pi.vercel.app** — built from `master`, all
eleven stages shipped, plus the public-demo lane (§3): a kill switch, credit
caps and guest mode. **Two manual steps stand between that and a public link
— see §3.**

---

## 1. Read this before touching anything

| Fact | Value |
|---|---|
| Production URL | `https://healthcarehelper-pi.vercel.app` |
| Production branch | `master` (NOT `main` — see §6) |
| Repo | `github.com/ahdilButt/healthcarehelper` |
| Vercel scope/project | `healthcarehelper / healthcarehelper` |
| Deploys on | every push to `master`, automatically |
| Supabase project | `itpdyathhuxvwbnhczgg` (eu-west-2) — new, 2026-07-27 |
| Sign-in that works, with full data | `amira@example.com` (mint a link — not a real inbox) |
| Sign-in that works, blank | `dad@example.com` (same) |

`main` is the design lane's branch and is a **different application**. If the
site ever shows a page titled "Healthcare Helper - AI Task Automation",
production has reverted to `main`.

> **The original Supabase project is no longer reachable (2026-07-27).** A
> fresh one is now the supported path and takes about ten minutes, four of the
> six steps being one command — **[SUPABASE-SETUP.md](SUPABASE-SETUP.md)**.
> Nothing is lost: the record rebuilds from the fixtures in this repo, by
> machine, with no AI spend, and comes out with the right doses first time.

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
the v0 design-lane integration, invites, sign-out, "Add someone else", and the
public-demo lane below.

---

## 3. The public-demo lane — built, with two manual steps outstanding

The user's words: *"turn this site into a deployed website — just a playable
demo… let those who use it upload and talk to it… then cut off all access in
3–7 days… and cap the credits."*

All three are built and pushed. What remains is setup, not code, and it now
lives in **[SUPABASE-SETUP.md](SUPABASE-SETUP.md)** — `npm run setup:fresh`
applies both SQL files, makes the bucket and seeds the record. Two things stay
manual because they are dashboard switches:

1. **Anonymous sign-ins**: Supabase → Authentication → Sign In / Providers.
   Until then "Have a look around first" answers *"Guest access is not
   switched on for this demo"* (403).
2. **Auth URL configuration** — site URL and redirect URLs, so magic links
   land back on the right host. Guests never touch it.

Then set in Vercel: `DEMO_CLOSES_AT`, and optionally `DEMO_OWNER_EMAIL`,
`DEMO_BUDGET_*`, `DEMO_TEMPLATE_PERSON_ID` (see `.env.example`).
`npm run demo:check` answers "is this actually fenced?" in one screen.

### 3a. Guest mode — `POST /api/demo/guest`
Anonymous Supabase sessions, one private copy of the demo record each. Not a
shared login: everyone would write into the same record and the third visitor
would find the second visitor's corrections on somebody else's father. An
anonymous user is a real account with a real id, so every membership check and
RLS policy behaves as it does for a family — there is no guest branch anywhere
else in the app.

`lib/demo/clone.ts` remaps every id it carries, so a fact can never cite a
letter in another record. Corrections travel (the overlay *is* the current
value); taken events, conversations and capsules do not. `storage_path` is
shared rather than duplicated — originals are immutable and every read is a
signed URL minted after a membership check on the row.

`npm run demo:clone-probe` proves it without needing the auth toggle: copies to
a throwaway account, compares every table row-for-row, checks no fact cites a
template document, then deletes both. Last run: 27 documents, 123 facts, 3.7s.

Entry points: the welcome screen (replacing "See the demo story", which pointed
at a sign-in wall) and `/signin`.

### 3b. Kill switch — `DEMO_CLOSES_AT`
An ISO instant, read in `proxy.ts` on every request. Past it, pages rewrite to
`/closed` and API routes answer the 410 envelope — capsule links, `/signin` and
the cron tick included. Editing it in Vercel takes effect on the next request,
with no deploy, and is reversible. An unreadable date **fails open** and logs.

Verified with the date moved into the past: `/`, `/timeline`, `/signin` and
`/c/<token>` all serve the closed page; `/api/today/x` answers
`{"error":{"code":"expired"}}` with 410.

A countdown banner shows on the welcome screen and inside the shell while it is
open, and the cron tick emails `DEMO_OWNER_EMAIL` once, about a day before.

### 3c. Credit caps — `lib/usage/meter.ts`
Counters in `usage_counters`, incremented through `bump_usage()` so two
concurrent requests cannot lose a spend.

- **Claude** — counted in money, not tokens (`anthropic:usd_micros`), because
  an output token costs five times an input one. Every call goes through
  `createMessage()`; `claude()` is private, so there is one metered way in.
  Checked before, charged after, so the ceiling can overshoot by one call.
- **ElevenLabs** — `elevenlabs:chars`, reserved up front (the length is known),
  so 5000 characters holds exactly. Over budget degrades to the browser voice.
- **Per visitor** — `anthropic:calls:<user>`, so one person cannot drain the
  pot before the next arrives. The Today brief is deliberately *not* charged
  per user: it fires on page load, and already falls back to a computed line.
- **Guests** — `demo:guests`, refunded if provisioning fails.

Fails **open** and loudly if the table is missing: refusing every paid call
would turn one un-applied migration into a dead demo, and the kill switch
already bounds the window. `npm run test:extraction` and `npm run ingest` set
`USAGE_METER_OFF` — a developer's £2 gate run is not the visitors' budget.

### 3d. Smaller, known, unfixed
- **Conditions extract noisily** — the seeded record now has the correct 4,
  because the fixtures are clean; the old project's 15 came from live ingest.
  The defect is in the Stage B prompt, not the data, so it returns the moment
  anyone photographs a letter. Symptoms ("Breathlessness on exertion") and echo
  findings get recorded as conditions. Most visible on the doctor brief.
- **The guided tour** (3–5 screens, ONBOARDING-PAGE-SPEC) still does not exist.
  That slot on the welcome screen is now "Have a look around first", which
  provisions a guest record and drops them on the timeline.
- **No delete** — a document can be merged away but never removed, and there is
  no account deletion. Fine for a demo, not for real users. Guest records are
  the same: they accumulate, one person + ~27 documents each, until someone
  removes them by hand (`delete from persons where …` cascades).
- **`public/healthcare-helper-logo.png`** is now unused (the lockup is text).

---

## 4. Flags — things that will bite

1. **The service-role key is in `main`'s git history** (`demo-data/.env.local`,
   commit `0c90373`). It bypasses every RLS policy. **Rotate before any real
   user touches this.** Not a demo blocker; is a real-users blocker.
2. ~~One Supabase project is shared with the design lane~~ — moot once the new
   project is stood up, and worth keeping that way: their seed used to write
   into the demo record, and 12 `placeholder.pdf` documents once appeared
   mid-ingest. Do not hand the new keys to the design lane.
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
   `GET /api/today/:personId/brief`, `POST /api/demo/guest`.
10. **`usage_counters` is an addition too** — `supabase/demo-mode.sql`, a new
    table and one function. `supabase/schema.sql` is untouched.
11. **Every guest shares the demo record's files.** Cloned documents keep the
    template's `storage_path`. Deleting the template's rows would leave every
    guest copy pointing at files that are still there, but wiping the storage
    bucket would blank all of them at once. `npm run wipe` is the one to watch.

---

## 5. Accounts and data, as they stand

**Rebuilt from fixtures on the new project, 2026-07-27.** One record, nothing
else — no design-lane placeholders, no half-ingested duplicates.

| Email | Sees |
|---|---|
| `amira@example.com` | **Dad — 14 documents, 48 facts, 7 medicines** (owner) |
| `dad@example.com` | nothing — lands on onboarding |
| anyone else | a magic link, or the guest button |

The record is **"Dad"**, person id printed by the seed. Every guest gets a
private copy of it (§3a), so it is also the template — renaming or emptying it
changes what every future visitor arrives to.

The medicines come out of the fixtures correct: Ramipril 5mg, Bisoprolol
2.5mg, Furosemide 40mg, Metformin 1g bd, Atorvastatin 20mg, GTN patch,
Amlodipine. The hand-corrections this section used to describe are gone with
the old project — they were only ever needed because those rows had been
ingested by an older extractor.

**Routines are created on first view**, not by the seed: `GET /api/today/:id`
calls `ensureRoutines`. A freshly seeded record therefore has none until
somebody opens Today, which is also true of every guest copy. Nothing to do —
just do not read "0 routines" as a failed seed.

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

npm run setup:fresh          # a new Supabase project, from nothing to seeded
npm run db:apply             # just the SQL (schema.sql + demo-mode.sql)

npm run demo:check           # is the demo actually fenced? (date, table, spend)
npm run demo:clone-probe     # guest mode's record copy, verified and cleaned up

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
second write path. The same rule now covers spending: every Claude call goes
through `createMessage()` and `claude()` is private, because a second way in
is a hole in the ceiling.

**A guest is not a special case.** They get a real account and a real record,
so no membership check, RLS policy or capsule route needs to know about them.
If you find yourself writing `if (isGuest)`, something has gone wrong.

**The caps fail open, the kill switch fails open.** Both would rather run
uncapped than refuse a live demo, and both say so in the log. That is only
defensible because the two are independent: the switch bounds the window even
if the counters are missing.

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
