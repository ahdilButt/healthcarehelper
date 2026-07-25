# PROGRESS.md — HealthcareHelper works-lane

*Resume a fresh session with: **"Read CLAUDE.md and PROGRESS.md, continue autopilot."***

Last updated: end of Stage 10. Every feature stage is built; Stage 11's M3 "unplug" is the one thing left and it needs a decision (see **Flags**).

---

## Where the build is

| Stage | State | Evidence |
|---|---|---|
| 0 · Dataset | ✅ done | `npm run validate:dataset` → 15 artefacts / 15 fixtures / 71 facts / 2 amber · OK |
| 1 · Scaffold | ✅ done | `npm run build` clean |
| 2 · Seed | ✅ done | `npm run seed:reset` → 14 documents, 48 facts |
| 3 · Auth + persons + invites | ✅ done | routes build; no server secret in `.next/static` |
| 4 · Ingest (Stage A + B) | ✅ done | `npm run test:extraction` → **15/15 documents, 71 checks, PASS** |
| 5 · Narration / needs-a-look / merge | ✅ done | processing card polls; type-it-in and retake both wired; merge prompt survives a reload |
| 6 · Timeline + corrections | ✅ done | 6 card variants, detail sheet, Fix this, view original — checked in a browser |
| 7 · Ask + translate | ✅ done | kidneys question cites docs 6/7/8; absent topic answers honestly; doc 8 translates |
| 8 · Routines / Today / SMS / cron | ✅ done | 7 doses, patch rotation, badge, tick sends to both members and is idempotent |
| 9 · Capsules + `/c/[token]` | ✅ done | 3 presets verified with curl and no cookies; revoked → 410; unconfirmed facts absent |
| 10 · Watch-cards + Chase this | ✅ done | overdue nephrology referral drafts a letter carrying the real reference number |
| 11 · M3 self-test + runbook | ✅ done | wiped, onboarded and uploaded through the UI, 15 artefacts ingested live; 4 defects found and fixed; `RUNBOOK.md`; security checklist 10/10 |

**Next action:** the conditions gap (flag 2), then a remote so this can deploy.

---

## The M3 unplug, and what it found

Database wiped, onboarding walked in the browser, one letter photographed
through the app, then all 15 artefacts ingested in document-date order through
the real pipeline. Four defects the seeded record could never have surfaced —
the seed writes with the service role, in one pass, in the right order:

1. **Creating a person failed.** `memberships` has no insert policy; the owner
   row was refused by RLS. Fixed on the server-side path the schema names.
2. **Uploading a letter failed.** The bucket has no policies for authenticated
   users. All storage now goes through `lib/storage.ts` with the service role,
   after the membership check.
3. **A mention became a dose.** "dose not stated" overwrote Metformin's "1 g
   twice daily" and invented two changes.
4. **Every dose read "quantity 28"** — the pharmacy slip is last in and its
   wording is longer, and `richerDose` preferred length.

End state now matches DATASET-BIBLE §4: the six current medicines at the right
doses, Amlodipine stopped, one Ramipril 2.5→5 change on 12 May, the penicillin
allergy, Atorvastatin amber at 0.65, and — the rule the product rests on — the
handwritten pharmacy note left Furosemide at 40mg and raised a question.

---

## Flags for you

1. **Something else is writing to this Supabase project.** Twelve documents
   with `storage_path` ending `placeholder.pdf`, doc types this codebase does
   not use (`gp_letter`, `blood_test_result`, `med_label`) and 2025 dates
   appeared mid-ingest at 19:26:34. Nothing in this repo creates them. They are
   still in the database and they pollute every count. If that is the other
   lane sharing one project, the two lanes need separate Supabase projects
   before the demo — I have not deleted anyone else's rows.
2. **Conditions come out noisy: 15 where the bible says 4.** Symptoms are being
   recorded as conditions ("Breathlessness on exertion", "Ankle swelling"), as
   are echo findings, and "Diabetes" sits beside "Type 2 diabetes mellitus
   (diagnosed 2015)". Deduping on the diagnosis fixed the parenthetical
   duplicates; the rest is a Stage B prompt tightening — say what a condition
   is and is not — plus a fixture to hold it. Not dangerous (nothing acts on
   conditions except display and the capsule), but it reads badly on the
   doctor brief.
3. **No git remote.** Twelve commits are local; nothing is pushed and Vercel
   has not deployed. Paste a URL and I will push the history.
4. **`EMAIL_API_KEY` is a placeholder** (`re_PAS…`). `lib/notify/send.ts` treats an unusable key as dry-run, so nothing breaks — but email fallback is not real until it is replaced.
5. **`SMS_DRY_RUN=true`.** Twilio SID/token/number are filled; flipping the flag to `false` is all that is needed. `npm run tick -- 08:00` then sends for real.
6. **Phone numbers live on the auth user.** The frozen schema has no phone column, so `npm run set-phone -- <email> <+44…>` writes it to `user_metadata`, which is where `lib/notify/recipients.ts` looks. Without one, a member falls back to email.
7. **pg_cron is not scheduled.** The snippet at the bottom of `supabase/schema.sql` needs running once there is a public URL.
8. **A fresh seed makes the next tick send a burst** of what-changed messages, because every med change is "new" within the 48-hour lookback. Harmless in dry-run; worth knowing before flipping the flag.
9. **Routes added beyond the frozen contract** (all additions, no signature moved): `POST /api/documents/:id/transcript`, `GET /api/persons/:id/duplicates`, `GET /api/loops/:id/chase`, `PATCH /api/persons/:id`.
10. **12 npm audit warnings** are pre-existing dev-tooling transitives from `create-next-app`.

---

## What exists, and where

```
lib/
  constants.ts          CONFIRMED_THRESHOLD, PRODUCT_LAW (verbatim in every AI prompt)
  types.ts              domain types mirroring the frozen schema
  person.ts             current-person resolution, re-validated against memberships
  api/errors.ts         the universal {error:{code,message}} envelope + route() wrapper
  api/guards.ts         requireUser / requireMember / requireOwner / requireCronSecret
  api/tokens.ts         192-bit base64url URL tokens
  supabase/{server,service,client}.ts    service.ts carries `server-only`
  ai/claude.ts          one client; CLAUDE_MODEL = claude-opus-5; refusal handling
  ingest/…              stage-a, stage-b, write-facts, medications, dedupe, pipeline
  facts/read.ts         THE correction overlay — every surface reads facts through it
  timeline/build.ts     the merged feed, corrections applied
  ask/context.ts        the record written out for Claude, every fact referenced
  ask/answer.ts         cited answers + GP questions
  ask/translate.ts      "What this letter says"
  ask/chase.ts          the drafted chase letter
  routines/time.ts      Europe/London wall-clock maths (DST-correct, unit tested)
  routines/schedule.ts  schedules built from the prescriber's own words
  routines/today.ts     the Today view + site rotation
  notify/{send,recipients,tick}.ts   SMS/email, who to tell, one minute of cron
  capsules/{build,access,wallet}.ts  scope presets, token checks, the wallet PDF
app/
  (tabs)/timeline · today · ask · share
  api/… documents, facts, persons, invites, ask, conversations, routines, today,
        taken, capsules, loops, cron/tick, webhooks/twilio-status
  c/[token]         the public clinical page · c/gone returns the real 410
components/  timeline · today · ask · share · ui · shell
scripts/     seed · render-demo-docs · validate-dataset · test-extraction · magic-link
             setup-storage · check-db · ask-probe · tick-probe · set-phone · security-check
```

### Commands

```
npm run dev
npm run wipe -- --yes-really  # empty the record (M3)
npm run ingest              # the 15 artefacts through the real pipeline
npm run seed:reset          # rebuild Dad's record from the fixtures
npm run test:extraction     # the hard gate — real pipeline vs fixtures (~£1–2)
npm run validate:dataset    # offline dataset guard, free
npm run tick -- 08:00       # run one minute of cron, at a time you choose
npm run set-phone -- <email> <+44…>
npm run security-check -- http://localhost:3000
npm run ask -- "question"   # the Ask brain without a browser
npm run magic-link          # sign in without an inbox
npm run build && npm run lint && npm test
```

---

## Decisions worth knowing before you touch this

**The seed and the pipeline share one writer.** `writeFacts()` is the only thing that inserts fact rows, so a seeded record and an ingested one are indistinguishable downstream. Do not add a second write path.

**Every surface reads facts through `lib/facts/read.ts`.** Timeline, Today, Ask and capsules all apply the correction overlay, so a fix made once cannot be missing anywhere else. Add a surface, use this file.

**Correcting a fact clears its amber; confirming does not move a dose.** Someone typing a value is the human check the badge was asking for — without that, the one value she wrote herself would be the one the capsule left out. But a one-tap *confirm* only clears the badge: `write-facts.ts` refuses to let an unconfirmed reading rewrite a live dose precisely so a blurred box cannot become a treatment change, and confirm must not be the back door into the same thing.

**A correction the app would then ignore is worse than none.** Values are normalised at the route — UK-order dates, known loop states, numeric readings — and refused in plain words when unreadable. The UI offers a date picker or a chooser rather than free text.

**Unconfirmed facts cannot move a dose, enter a capsule, or send a text.** Three separate code paths enforce the same threshold. There are fixtures (12, S2) that fail if the first regresses, and a curl check in the Stage 9 commit for the second.

**A dose change means the strength moved.** `lib/ingest/medications.ts` — a repeat slip restating "Ramipril 5mg" is not a change. 11 unit tests guard it.

**Legibility crosses the stage boundary.** Stage A rates `clear|degraded|poor`; Stage B scores accordingly. Handwriting is always unconfirmed.

**Wall-clock times are resolved through Europe/London properly.** "08:00" still means eight in the morning after the clocks change. Tested on both sides of the March boundary.

**The patch is scheduled before its words are read.** Its instruction says "each morning and off at night"; matching on the night half put the reminder at 21:30. Caught by reading the seeded output.

**One text per medicine round, with a stable key.** Five buzzes at eight in the morning is a reason to turn reminders off, and a cron that catches up after an outage must not re-send.

**Dead capsule links answer 410.** A rendered page cannot set its own status, so `/c/[token]` redirects to `/c/gone`, which carries its own markup and returns the real code.

**The extraction comparator is deliberately loose on names and exact on numbers**, per DATA-SHAPES §4.

**Fixtures record extras as notes, not failures.** Missing an expected fact fails; finding more does not.

---

## Cost note

`npm run test:extraction` runs real Claude vision + extraction over 15 artefacts (~£1–2 per cold run). Stage A output is cached under `demo-data/.transcripts/` (gitignored), so iterating on the *extraction* prompt is cheap. `npm run ask` and the Chase draft are a few pence each.
