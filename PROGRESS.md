# PROGRESS.md — HealthcareHelper works-lane

*Resume a fresh session with: **"Read CLAUDE.md and PROGRESS.md, continue autopilot."***

Last updated: end of Stage 6 (timeline live in the browser).

---

## Where the build is

| Stage | State | Evidence |
|---|---|---|
| 0 · Dataset | ✅ done | `npm run validate:dataset` → 15 artefacts / 15 fixtures / 71 facts / 2 amber · OK |
| 1 · Scaffold | ✅ done | `npm run build` clean; app hoisted to repo root |
| 2 · Seed | ✅ done | `npm run seed:reset` → 14 documents, 48 facts, end state matches the bible |
| 3 · Auth + persons + invites | ✅ done | routes build; service-role key absent from `.next/static` |
| 4 · Ingest (Stage A + B) | ✅ done | `npm run test:extraction` → **15/15 documents, 71 checks, PASS** (cold run) |
| 5 · Narration card / needs-a-look / merge prompt | 🟡 partial | processing + needs-a-look cards render and poll; merge-prompt UI still to build (API done) |
| 6 · Timeline API + UI | 🟡 mostly | feed + month headers + 6 card variants + view-original verified in browser; "Fix this" correction overlay still to build |
| 7 · Ask API + UI + translate | ⛔ not started | — |
| 8 · Routines / Today / SMS / cron | ⛔ not started | — |
| 9 · Capsules + `/c/[token]` + QR + wallet PDF | ⛔ not started | — |
| 10 · Watch-cards + "Chase this?" | ⛔ not started | — |
| 11 · M3 self-test + runbook | ⛔ not started | — |

**Next action:** finish Stage 6 (the "Fix this" correction overlay + `/api/facts/:table/:id` routes, which nothing else depends on), then Stage 7 (Ask). The seeded record renders end-to-end today.

---

## Flags for you (nothing here is blocking)

1. **No git remote.** Five stages are committed locally but nothing is pushed, so Vercel has not deployed. Add one and I'll push the history:
   `git remote add origin <url>`
2. **`EMAIL_API_KEY` is a placeholder** (`re_PAS…`). Email fallback will go behind the same dry-run flag as SMS in Stage 8. Real Resend key needed before M4.
3. **`SMS_DRY_RUN=true`** as you instructed — Stage 8 will log messages instead of sending. Twilio SID/token/number *are* filled, so flipping it to `false` is all that's needed for real texts.
4. **One contract note, no change made.** `documents.merged_into` is used with a self-reference (`merged_into = own id`) to record "user chose keep both". The frozen schema has no other column for that decision and I did not want to change a contract. If the contract owners would rather have an explicit column, that's a 1-line migration.
5. **pg_cron is not scheduled yet.** The snippet at the bottom of `supabase/schema.sql` needs running once the app has a public URL (Stage 8).
6. **12 npm audit warnings** are pre-existing transitive dev-tooling issues from `create-next-app` (eslint/postcss), not runtime, and not introduced by this work.

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
  ingest/schema.ts      ExtractedFacts (the one fact shape) + the JSON Schema for Claude
  ingest/stage-a.ts     vision transcription + legibility rating
  ingest/stage-b.ts     extraction with calibrated confidence
  ingest/write-facts.ts THE ONLY path that writes fact rows
  ingest/medications.ts medicine identity + dose-change semantics (unit tested)
  ingest/dedupe.ts      duplicate detection (unit tested)
  ingest/pipeline.ts    orchestration, stateless
  demo/artefact.ts      artefact spec + deterministic transcript
  demo/fixture.ts       fixture -> facts, high/low -> 0.95/0.62, unit normalisation
  demo/compare.ts       the extraction comparator
app/
  page.tsx              front door routing
  signin, onboarding, invite/[token], auth/callback
  (tabs)/               layout + timeline/today/ask/share  ← PLACEHOLDERS, build these
  api/persons, api/invites, api/invites/accept
  api/documents, api/documents/[id]{,/merge,/file}
components/ui           primitives + line illustrations (incl. BodyMap for patch sites)
components/shell        tab bar, person switcher
scripts/                seed, render-demo-docs, validate-dataset, test-extraction,
                        magic-link (dev sign-in without an inbox), setup-storage, check-db
demo-data/              DATASET-BIBLE.md · source/*.doc.json · fixtures/*.json · docs/*
```

### Commands

```
npm run dev
npm run seed:reset          # rebuild Dad's record from the fixtures
npm run test:extraction     # the hard gate — real pipeline vs fixtures
npm run test:extraction -- --only=08,12   # subset
npm run test:extraction -- --fresh        # ignore the Stage A transcript cache
npm run validate:dataset    # offline dataset guard, free
npm run render:docs         # regenerate the artefacts
npm run magic-link          # print a sign-in link (no inbox needed)
npm run build && npm run lint && npm test
```

---

## Decisions worth knowing before you touch this

**The seed and the pipeline share one writer.** `writeFacts()` is the only thing that inserts fact rows, so a seeded record and an ingested one are indistinguishable downstream. That is what lets Stages 5–10 be built against `npm run seed` without waiting for ingest. Do not add a second write path.

**Unconfirmed facts cannot move a dose.** `writeFacts` refuses any dose change or stop below `CONFIRMED_THRESHOLD`. This is why the ambiguous handwritten pharmacy note leaves Furosemide at 40 mg and raises a question instead of silently recording 80 mg and firing an SMS. SPEC-FINAL §3 requires it; there is a fixture (S2) that fails if it regresses.

**A dose change means the strength moved.** `lib/ingest/medications.ts` — a repeat slip restating "Ramipril 5mg" against a stored "Ramipril 5mg once daily" is *not* a change. Before this existed, re-ingesting the pharmacy slip produced five bogus med_change_events, i.e. five wrong "what changed" alerts. 11 unit tests guard it.

**Legibility crosses the stage boundary.** Stage B only sees text, so without Stage A telling it how the source looked, a blurred box yields a clean transcript and a confident wrong answer. Stage A rates `clear|degraded|poor`; Stage B scores accordingly. Related rules: handwriting is always unconfirmed, and a named follow-up is an appointment even without a date.

**The extraction comparator is deliberately loose on names and exact on numbers**, per DATA-SHAPES §4. Appointment titles get their own looser matcher because they are prose; loosening the general one would start matching "Serum creatinine" to "Serum sodium".

**Fixtures record extras as notes, not failures.** The pipeline routinely finds legitimate open loops the curator did not enumerate. Missing an expected fact fails; finding more does not.

---

## Cost note

`npm run test:extraction` runs real Claude vision + extraction over 15 artefacts (~£1–2 per cold run). Stage A output is cached under `demo-data/.transcripts/` (gitignored), so iterating on the *extraction* prompt is cheap — only `--fresh` re-pays for vision.
