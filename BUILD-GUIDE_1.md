# BUILD-GUIDE.md — HealthcareHelper: three tracks, zero collisions
*2026-07-25. The operating manual for the build phase. Team: **Dev A** + **Dev B** (each driving their own Claude Code session) + the **domain expert** (Track C, data curation). ECC is dropped — plain Claude Code, this guide, and SPEC-FINAL.md are the whole method. Supabase backend · Vercel hosting · Claude API.*

*The four contract files rule everything: **SPEC-FINAL.md** (what we're building) · **SUPABASE-SCHEMA.sql** (the database) · **API-CONTRACTS.md** (the routes) · **DATA-SHAPES.md** (the dataset). This guide only arranges the work.*

---

## 1. Why nobody blocks anybody (read this first)

The contracts are **frozen**. Both dev tracks and the curation track hang off them independently:

- **Track A builds data-IN** (ingest → facts → timeline) and tests against the curator's fixtures.
- **Track B builds data-OUT** (ask, routines, capsules, notifications) and runs on **seeded data** — a seed script loads the fixtures' expected-facts JSON straight into the tables, so B has a full, realistic record from Day 0 **without waiting for A's pipeline or C's finished letters**.
- **Track C curates against DATA-SHAPES.md** — the fixture format is fixed, so curation never waits on code.

When A's pipeline produces what C's fixtures promise, and B's features run on those same tables, the seams disappear: unplug the seed, ingest live, and the 150-second demo runs end-to-end. **The seed script is the no-collision trick — treat it as sacred.**

**Contract-change rule:** if either dev needs to change SUPABASE-SCHEMA.sql, API-CONTRACTS.md, or the fixture format — 10-minute sync, both agree, bump the "frozen" date at the top of the changed file, tell the curator if fixtures are affected. Never change a contract silently.

## 2. Ownership map (the no-toe-stepping law)

| Area | Owner | Never touched by |
|---|---|---|
| `/app/(tabs)/timeline`, `/app/documents`, `/lib/ingest`, `/api/documents`, `/api/facts`, `/api/persons`, `/api/invites`, seed script | **Dev A** | Dev B |
| `/app/(tabs)/today`, `/app/(tabs)/ask`, `/app/(tabs)/share`, `/app/c/[token]`, `/api/ask`, `/api/routines`, `/api/today`, `/api/taken`, `/api/capsules`, `/api/cron`, `/api/webhooks`, onboarding UI | **Dev B** | Dev A |
| `/components/ui` (tokens + primitives from SPEC-FINAL §8) | **Dev B builds Day 0–1**, then frozen; changes by agreement | — |
| `demo-data/` | **Domain expert** (Dev A syncs) | Dev B |
| Contract files + this guide | Both devs jointly | — |

Git: trunk `main` (protected, always deployable) · branches `dev-a/*`, `dev-b/*` · merge to main at least twice a day (small merges, no long-lived branches) · the ownership map means merges never conflict · Vercel auto-deploys previews per branch and production from main. Deploy the hello-world on Day 0 — deployment is never a last-day surprise.

## 3. The three tracks

### Day 0 — together, ~2 hours (the only synchronous block)
1. Create Supabase project → run SUPABASE-SCHEMA.sql → enable pg_cron + pg_net, schedule the tick (bottom of the schema file).
2. Create repo (`create-next-app`, TypeScript, Tailwind) → connect Vercel → set env keys (list in SPEC-FINAL §1) → deploy hello-world.
3. Dev B stubs `/components/ui` tokens + Card/Chip/Button primitives from SPEC-FINAL §8.
4. Dev A writes the **seed script** (`pnpm seed`): reads `demo-data/fixtures/*.json` → inserts persons (Amira, Dad), memberships, documents (with transcripts), all fact tables. Placeholder fixtures for docs 2, 5, 7, 8 by hand if the curator hasn't delivered yet.
5. Both kick off their Claude Code sessions with the prompts in §5.

### Track A — Dev A: the record spine (data-in)
A1 Auth + persons + invite flow (Amira creates Dad; invite link joins on second device) → A2 Upload → private storage → document row + processing card → A3 **Stage A transcribe** (all fixtures produce transcripts) → A4 **Stage B extract** (output matches expected-facts for every delivered fixture; amber cases come out amber) → A5 live-narration card wired to real counts → A6 Timeline feed + 6 card variants + detail sheet ("Fix this" correction overlay, view original via signed URL) → A7 merge prompt on 12b.
*Each step's "done when" is in SPEC-FINAL §12 Stage 1.*

### Track B — Dev B: the experience lanes (data-out, runs on seed)
B1 App shell: tabs (Timeline · Today · Ask · Share), person switcher, 3-screen onboarding → B2 Routines + Today (auto-schedules from seeded meds, taken toggles, patch body-map with site rotation) → B3 Ask (API + tab UI: citations as source chips, GP-questions closing card, safety line, honest not-in-record) → B4 Capsules (create/manage/preview, `/c/[token]` clinical page ×3 presets, QR, wallet PDF, view log, revoke) → B5 `/api/cron/tick` + Twilio SMS + email fallback (real texts on two phones) → B6 watch-cards + "Chase this?" drafted letter.
*"Done when" lines: SPEC-FINAL §12 Stages 2–4.*

### Track C — domain expert: curation (daytime, self-paced)
C1 Priority docs 1–8 + fixtures (the spine of the story) → C2 docs 9–12b (the silent referral, the amber box photo, the duplicate) → C3 shape-coverage specimens (DATA-SHAPES §3) → C4 the QA loop: devs run the pipeline on each delivery, mismatches come back as plain-English questions; artefact or pipeline gets fixed. *Everything the expert needs is in DATA-SHAPES.md — no developer required to start.*

### Integration milestones
- **M1 (mid-build):** A4 passes fixtures for docs 1–8 → A and C lock the extraction QA loop.
- **M2:** B's lanes all demo on seeded data → walkthrough on a phone.
- **M3 (the unplug):** wipe DB, NO seed, ingest the real artefacts through the UI, run the full 150-second script (SPEC-FINAL §0). This is the definition of ready-to-deploy.
- **M4:** production deploy on Vercel, both demo phones installed (PWA), SMS verified, runbook rehearsed once with a timer. *Stretch (voice) only starts after M3, per SPEC-FINAL §11 — and the Twilio spike already happened on Day 0 if you follow §4.*

## 4. Security checklist (the "completely secure" bar — verify at M3)
☐ RLS enabled on every table, zero anon policies (schema does this — verify with a logged-out query) ☐ service-role key server-only (grep the client bundle) ☐ documents bucket private; originals only via short-lived signed URLs after membership check ☐ capsule tokens ≥128-bit; server-side expiry/revocation checks; 410 on dead links; every open logged; per-IP rate limit on `/c/` ☐ `x-cron-secret` on the tick; Twilio webhook signature validated ☐ no PII in logs; fictional data only ☐ HTTPS everywhere (Vercel default) ☐ invite tokens single-use with expiry.

## 5. Claude Code kickoff prompts (paste verbatim, one per dev session)

**Dev A session:**
> Read SPEC-FINAL.md, SUPABASE-SCHEMA.sql, API-CONTRACTS.md, BUILD-GUIDE.md. You are Dev A's pair on Track A (BUILD-GUIDE §3): the record spine — auth/persons/invites, upload+storage, the two-stage ingest pipeline, facts + corrections overlay, timeline UI. Work ONLY in the Track-A areas of the ownership map (§2). Build to API-CONTRACTS.md signatures exactly; never modify contract files without me. TDD the pipeline against demo-data/fixtures — a stage is done only when its SPEC-FINAL §12 "done when" line passes. Design per SPEC-FINAL §4/§8 (375px first, warm tokens, human-meaning cards). Product law in every AI prompt you write: explains, educates, prepares questions — never diagnoses; every answer cites its source. Work stage by stage (A1→A7), propose a short plan per stage and wait for my YES. Stop and ask if blocked >30 min or before adding any dependency.

**Dev B session:**
> Read SPEC-FINAL.md, SUPABASE-SCHEMA.sql, API-CONTRACTS.md, BUILD-GUIDE.md. You are Dev B's pair on Track B (BUILD-GUIDE §3): shell/onboarding, design-system primitives, Routines+Today, Ask, Capsules incl. /c/[token], cron+Twilio SMS, watch-cards. Work ONLY in the Track-B areas of the ownership map (§2). Develop against seeded data (`pnpm seed`) — never wait on the ingest pipeline. Build to API-CONTRACTS.md signatures exactly; never modify contract files without me. Design per SPEC-FINAL §5–§9 (375px first; capsule pages use the separate clinical style). Product law in every AI prompt: explains, educates, prepares questions — never diagnoses; every answer cites its source; unconfirmed facts never enter capsules or alerts. Work stage by stage (B1→B6), propose a short plan per stage and wait for my YES. Stop and ask if blocked >30 min or before adding any dependency.

## 6. Env keys (Vercel + local `.env.local`)
Core: `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` · `ANTHROPIC_API_KEY` · `TWILIO_ACCOUNT_SID` · `TWILIO_AUTH_TOKEN` · `TWILIO_FROM_NUMBER` · `EMAIL_API_KEY` · `APP_URL` · `CRON_SECRET`. Stretch: `ELEVENLABS_API_KEY` · `TWILIO_VOICE_NUMBER` · `AGENT_TOOL_SECRET`.

## 7. If plans change
The two-dev plan document (when it lands in this folder) may re-cut Track A/B — fine: re-cut the **ownership map**, keep the contracts and the seed-script principle untouched, and note the change here. Any product-level change goes back through the spec room: SPEC-TRACKER + DECISION-BOARD + SPEC-FINAL updated together, then this guide.
