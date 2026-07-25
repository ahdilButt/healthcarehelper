# CLAUDE.md — HealthcareHelper (copy this file into the repo root)
*Auto-read by Claude Code at session start. This repo is built by TWO autonomous lanes: Claude Code (this session) builds everything that WORKS; v0/Demby builds everything that LOOKS (UI on branch `v0-ui`). You are the works-lane.*

## Read first, in order
1. `SPEC-FINAL.md` — the complete decided spec. Never reopen its decisions.
2. `API-CONTRACTS.md` — every route signature. Build to these exactly.
3. `supabase/schema.sql` — the database, already designed. Apply as-is.
4. `demo-data/DATA-SHAPES.md` — the dataset + fixture format.

## Mission & autonomy contract
Build the entire backend + wiring lane **continuously and autonomously**, stage by stage (order in AUTOPILOT section below). After each stage: run build + lint + tests, output PASS/FAIL per check, commit (conventional message), push — Vercel auto-deploys. Then IMMEDIATELY continue to the next stage.

**Only stop and ask when:** (a) an env key/secret is missing, (b) a frozen contract (schema / API signatures / fixture format) genuinely needs changing, (c) an action is destructive or costs money, (d) an ambiguity has no sensible default. Everything else: decide sensibly, note it in the commit message, keep going.

## Lane boundaries
- **Yours:** `lib/**`, `app/api/**`, `app/c/**` (capsule public page logic), `supabase/**`, `demo-data/**` (generation + fixtures), `scripts/**`, tests, auth, and WIRING v0's screens to real data.
- **v0's (Demby):** page shells and components under `app/(tabs)/**` and `components/**`, arriving via PRs from branch `v0-ui`, mock-driven. You may replace their mock imports with real API calls and fix type errors — preserve their look. If a screen you need hasn't arrived yet, build a plain functional version with the §8 tokens and swap it later — never block on UI.

## Hard rules
- **Product law, verbatim, in every AI-facing prompt you write:** the system explains, educates, and prepares questions for a clinician. It NEVER diagnoses, never advises treatment changes. Every AI answer cites its source document.
- Unconfirmed facts (confidence < 0.80, not user-confirmed) never enter capsules or notifications; Ask must caveat them.
- Extraction is TESTED: `npm run test:extraction` compares pipeline output to `demo-data/fixtures/*.json` — a stage claiming extraction works must show this passing.
- Phone-first 375px; capsule pages use the separate clinical style (SPEC-FINAL §7).
- Error envelope `{error:{code,message}}` on every route. No secrets in code, ever — `.env.local` only.
- Contracts are frozen. If you believe one must change, STOP and present the change + reason.

## Commands
`npm run dev` · `npm run seed` (fixtures → DB) · `npm run test:extraction` · `npm run build && npm run lint`

## Env (in `.env.local`, values from the team secrets note)
NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY · ANTHROPIC_API_KEY · TWILIO_ACCOUNT_SID · TWILIO_AUTH_TOKEN · TWILIO_FROM_NUMBER · EMAIL_API_KEY · APP_URL · CRON_SECRET

## AUTOPILOT build order (each stage's "done when" = SPEC-FINAL §12)
0. **Dataset first:** if `demo-data/docs` is empty, GENERATE all 13 fictional documents (as realistic HTML→PDF or styled text artefacts) + their fixture JSONs per DATA-SHAPES.md. Mark them DRAFT — the domain expert corrects later. This unblocks all testing.
1. Scaffold gaps (if fresh repo): Next.js app present, deps, `.env.example`, folders.
2. Seed script (`npm run seed`).
3. Auth + persons + memberships + invite link (magic link; Amira creates Dad).
4. Ingest: upload → private storage → document row → Stage A transcribe → Stage B extract (confidence per fact) → facts written. `test:extraction` green against fixtures.
5. Live-narration processing card wired; needs-a-look path; duplicate merge prompt.
6. Timeline API + wiring (month headers, 6 card variants, detail sheet, Fix-this overlay, view-original signed URL).
7. Ask API + wiring (citations, GP-questions card, safety line, honest not-in-record, amber caveats). Letter translation endpoint.
8. Routines: auto-schedules, Today API, taken events + site rotation; SMS via Twilio + email fallback; `/api/cron/tick` (+ pg_cron note in schema).
9. Capsules: create/manage/revoke/renew, view log, `/c/[token]` clinical page ×3 presets (server-side token checks, only confirmed facts, 410 page), QR + wallet PDF.
10. Watch-cards + "Chase this?" drafted letter.
11. **M3 self-test:** wipe, no seed, ingest the artefacts through the UI, walk the 150-second script (SPEC-FINAL §0), run the security checklist (BUILD-GUIDE §4). Output the demo runbook.
# Next.js version rules
@AGENTS.md
