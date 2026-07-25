# SPEC-FINAL.md — HealthcareHelper · the agent-ready build document
*Status: **COMPLETE** (2026-07-25). All ten spec sections resolved across six decision rounds. This file is the single source of truth for the build: every decision is inline, nothing here is open. `master_idea_document.md`, `the_plan.md` and `nhs_app_audit_and_vision.md` are background; where anything differs, THIS file wins. Change control: edits happen through a spec-room round and land in SPEC-TRACKER.md + DECISION-BOARD.md + this file together.*

---

## 0. The product, the law, the test

**HealthcareHelper** (working title) is a warm family tool for complex patients and their carers: photograph the shoebox of NHS letters and a living, shareable, understandable record of care assembles itself — a timeline that can explain itself in plain English, run the daily medication routine, and hand a 30-second brief to any doctor via QR.

**Demo persona:** Amira, 34, manages Dad (heart failure + type 2 diabetes + CKD) from another city. Fictional data only.

**PRODUCT LAW (appears in every relevant surface, prompt, and doc):** the system explains, educates, and prepares questions for a clinician. It NEVER diagnoses, never advises treatment changes. Every AI answer cites its source document. No NHS integration of any kind — all data is patient-held.

**Acceptance test — the 150-second demo (phone mirrored to projector):**
1. *(0–40s)* Shoebox: photograph letters → live narration ("Reading… found 3 medications") → the timeline assembles itself.
2. *(40–70s)* Ask: "What's actually wrong with Dad's kidneys?" → kind plain-English answer citing the nephrology/cardiology letters + "questions to ask the GP."
3. *(70–100s)* Routines: Today view; the patch body-map (left hip → right hip); a real SMS reminder lands on Dad's lock screen.
4. *(100–130s)* Capsule: QR → the doctor brief opens on a second phone, incognito. "She never retells the story again." Paramedic card shown on the lock screen.
5. *(130–150s)* Watch-card: the silent nephrology referral is overdue → "Chase this?" opens a drafted letter. **Finale (stretch lane, decided C4):** Dad phones the record live on speaker — backup clip pre-recorded as insurance.

---

## 1. Stack & rules

- **Next.js (App Router) + Supabase (Postgres, Auth, Storage, RLS) + Claude API (vision + text) + responsive PWA.** Design at 375px; 1440px must merely not break (centred ~720px column, tab bar becomes top bar).
- **Twilio SMS is CORE** (reminders + what-changed alerts). Email is the fallback channel. **ElevenLabs Agents + Twilio Voice = stretch lane**, isolated module; its failure cannot touch Stages 1–4. One Twilio account powers texts and the voice number.
- Repo rules: small files, no secrets in code, TDD against the demo-data fixtures, conventional commits per stage. Light mode only. English only (audience dial is roadmap).
- Env keys: `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` · `ANTHROPIC_API_KEY` · `TWILIO_ACCOUNT_SID` · `TWILIO_AUTH_TOKEN` · `TWILIO_FROM_NUMBER` · `EMAIL_API_KEY` (Resend or similar) · `APP_URL` — plus STRETCH: `ELEVENLABS_API_KEY`, `TWILIO_VOICE_NUMBER`.

## 2. Data model

**Entities**
- `users` (Supabase auth) → `memberships` (user × person × role). **Exactly two real logins in the demo: Amira (owner) + Dad (patient)**, joined by one minimal invite link. Viewers NEVER log in — capsule links only.
- `persons` — subjects of records (Dad; Amira's own record exists, empty in demo).
- `documents` — immutable originals (letter photo / PDF / voice audio) + stored transcript + doc_meta (type, date, sender).
- Extracted-fact tables — every row: `person_id` + `source_document_id` (+ page/region) + `confidence` (0–1). Tables: `conditions` · `medications` (current dose) + `med_change_events` (old → new, source letter) · `allergies` · `results` (value, unit, reference range, date) · `appointments`.
- `corrections` — overlay: fact ref, corrected value, who, when. **The AI extraction is never overwritten**; UI shows corrected value + small "edited" mark; original inspectable.
- `open_loops` — type, description, expected_date, state (waiting/done/overdue), source document. **Extracted from Stage 1** in the same pass as everything else.
- `capsules` — type (doctor_brief / paramedic / family), token, scope preset, expires_at, revoked_at + `capsule_views` log (timestamp, user-agent).
- `routines` — per-med schedule + `taken_events` (each logs patch site where relevant) + site-rotation state.
- `conversations` + messages; every answer stores citation refs to facts/documents.
- `notifications` — reminder / what-changed, per target user, delivery channel + status.

**Permissions**

| Role | Read | Add docs / mark taken | Correct facts | Capsules | Manage people |
|---|---|---|---|---|---|
| Owner (Amira) | all | ✓ | ✓ | create + revoke all | ✓ |
| Patient (Dad) | all | ✓ | ✓ | create own | ✗ |
| Carer (future) | all | ✓ | ✓ | create, not revoke others' | ✗ |
| Viewer | capsule scope only — no login | ✗ | ✗ | ✗ | ✗ |

**RLS intent:** every row carries `person_id`; access resolves through `memberships`. The public capsule route is the single unauthenticated path — server-side token + scope + expiry/revocation check, every open logged.

## 3. Ingest pipeline (photo / PDF / voice → facts)

- Three doors, one pipeline: photograph a letter · upload PDF bundle (SAR) · 30-second voice note. Camera-first; never a data-entry form.
- **TWO-STAGE, both Claude:** **Stage A — transcribe**: vision call → full plain transcript stored on the document (first-class: feeds Q&A, citations, debugging). **Stage B — extract**: text call → structured facts JSON (conditions, meds + changes, allergies, results, appointments, open loops) with per-fact confidence + doc_meta. Voice notes: same shape (audio transcript → extract). Each stage independently testable against fixtures.
- **Uncertainty: best guess + flag.** Always extract; facts with confidence < 0.8 (tunable constant) render **amber "unconfirmed"** with one-tap confirm/fix. **Riders (product law): unconfirmed facts are EXCLUDED from capsules and what-changed alerts until confirmed; Ask must say so when leaning on one.** A document that cannot be transcribed at all → "Needs a look" card (photo shown, plain words, retake or type-it-in).
- **Dedup: gentle merge prompt.** Probable duplicate (same date + sender + type, or near-identical transcript) → "This looks like the 12 May cardiology letter you already added — merge or keep both?" One tap; default merge; merged doc keeps both photos.
- **Processing UX: live narration** on the card — "Reading the letter… found 3 medications · 1 result · 1 thing to watch" — then facts slot into the timeline. This is the demo's first gasp.
- Corrections UI: any fact's detail sheet → "Fix this" → correction overlay.

## 4. Timeline

- **Flat feed, sticky month/year headers.** No episode grouping in v1 (parked). One chronological story per person; every item traceable to source.
- **Card anatomy — human-meaning header:** "Heart medicine dose went up" / "Kidney check result" + small type icon + date, one key payload line, source chip at bottom ("from the cardiology letter · 12 May"). Variants: letter · result · med-change · open-loop ("Things to watch") · needs-a-look · processing.
- Results: value + plain-English delta ("slightly higher than March") + direction arrow; semantic colour only when the letter itself flags out-of-range; full series on the detail sheet.
- Detail sheet: full extraction · "Fix this" · "What this letter says" plain-English translation · "View the original letter" (the stored photo — the citation made physical).
- Empty state: line-drawn shoebox + "Add the first letter — photograph it and watch Dad's story build."

## 5. Ask (the Q&A brain)

- **Lives in its own tab, and only there** (contextual entry parked). One conversation surface per person.
- Brain: Claude text with the person's transcripts + facts as context. System prompt embeds the product law verbatim. Every answer carries source chips (same component as timeline) → tap → fact detail → original letter.
- Every substantive answer ends with a soft, copyable **"Questions you might ask the GP"** card.
- Safety copy: permanent quiet line under the input — *"Explains and prepares questions — never diagnoses."*
- Not-in-record: "Dad's records don't mention this" + offer to add it to the GP-questions list. Never guess. Unconfirmed facts are caveated when used.
- The stretch voice agent calls this same brain via tool-calls — one brain, two mouths.

## 6. Routines (the daily layer)

- Schedules auto-built from extracted meds where possible, hand-editable always.
- **Today view:** meds grouped morning / afternoon / evening; each row = human name + dose + how (patch rows link to body-map) + one-tap taken toggle; missed = amber, never red-shaming.
- **Reminders leave the app (user decision, R6): SMS first via Twilio, email fallback.** No web-push build. In-app, Today shows "due now" when open. Reminders go to Dad's phone AND Amira's.
- **What-changed alert:** timeline card + SMS to both phones, always citing the letter — "Ramipril is now 5mg (was 2.5mg) — from the cardiology letter of 12 May."
- **Site rotation (C3, decided IN):** line-drawn body outline; last site marked, next site pulsing in accent; each patch taken-event logs its site; sites configurable per med (Dad's GTN patch: hips / upper arms).

## 7. Capsules (share links)

- **All three types ship (C2):** doctor brief · paramedic card · family capsule — as **ONE clinical page template × three scope presets** (the third type costs a preset, not a page).
- **Look (B6): clinical utility page** — deliberately unlike the warm app: white, tight fixed order **allergies → current meds → active problems → recent results → in-flight**, print-friendly, quiet branding, header "Shared by Amira · expires in 24h".
- Paramedic preset: allergies · meds · conditions · emergency contact · DNR status (manually set) — lock-screen QR guidance + printable wallet-card PDF.
- Family preset: current meds + upcoming appointments only.
- Expiry defaults: doctor brief 24h · paramedic none-until-revoked · family 30 days renewable. All revocable; every open logged (shown on the manage card: "Opened Tue 14:02").
- Security: unguessable random token (≥128-bit) in URL; no viewer accounts; server-side scope/expiry/revocation checks; basic rate limiting. Unconfirmed facts never appear.
- Owner flow: Share tab → pick type → **preview exactly what will be visible** → create → link + QR + expiry → manage (views, renew, revoke).

## 8. Design system

- **Identity:** warm family tool; Apple Health / Things anchor; one idea per card, never a dashboard; airy; system fonts; light mode.
- **Tokens (locked as defaults):** bg `#FAF6F1` · card `#FFFFFF` · text `#201A17` · secondary `#6E6259` · hairline `#EFE7DF` · **accent apricot `#E86A33`** + wash `#FFE8DC` · semantic green `#2E7D5B` / amber `#B77900` / red `#C6432D` (status ONLY). Type: page title 28 semibold · card header 17 semibold · body 15 · meta 13; line-height ≈1.45. Card radius 16 · chip 10 · pill buttons · 4pt spacing scale · flat surfaces, hairline borders over shadows. Capsule pages override: white, near-black, no warmth, print-safe.
- **Illustration (B7): minimal single-weight line SVGs in accent** — shoebox, body outline, envelope. No photography.
- **Components:** TimelineCard (6 variants) · MonthHeader · SourceChip · DetailSheet · UnconfirmedBadge · TodayMedRow · SiteRotationBodyMap · WhatChangedAlertCard · AskThread (+ GP-questions card) · CapsulePage (×3 presets) · CapsuleManageCard · PersonSwitcher · TabBar · EmptyState · OnboardingCards · InviteFlow.
- **Tone of words (law of naming):** "Dad's meds" not "Medications" · "Things to watch" not "Open loops" · "Dad's story" not "Records" · "Share with a doctor" not "Generate capsule" · "Needs a look" not "Extraction error" · "From the cardiology letter, 12 May" not "Source: doc_0012" · "Unconfirmed — tap to check" not "Low confidence". Button verbs: Add a letter · Ask · Share · Fix this. The words "patient", "profile", "extraction", "AI" never appear in body UI (allowed on the trust/about page).

## 9. App shell, navigation, onboarding

- **Tabs: Timeline · Today · Ask · Share** + floating camera "+" on Timeline/Today. Person switcher top-left (Amira ⇄ "Dad's story"); settings behind it.
- **Onboarding — three screens then camera:** "Whose care are you managing?" (Me / Someone I care for) → their name + optional "what are they managing?" (skippable) → "Add the first letter", camera open. Magic-link auth first; Dad joins via invite link.
- Notifications: SMS/email external; in-app = cards + a badge count on Today; no notification centre in v1.

## 10. Demo dataset ("Dad") — generate at Stage 0, with expected-facts JSON fixtures per document

| # | Document (fictional, NHS-real in look) | Date | Proves |
|---|---|---|---|
| 1 | GP referral → cardiology | Jan 2026 | referral loop opens |
| 2 | Cardiology letter — HF diagnosis; Ramipril 2.5mg + Bisoprolol started; "will write within 3 weeks" | Feb 2026 | meds + loop w/ expected date |
| 3 | Echo report | Feb 2026 | results values/units |
| 4 | Discharge summary — March admission; adds Furosemide | Mar 2026 | discharge parsing · heavy month |
| 5 | GP med review — full list; **GTN patch 5mg** (hips/upper arms); penicillin allergy | Apr 2026 | the patch · allergy |
| 6 | Blood panel — **eGFR 52**, HbA1c | Mar 2026 | trend baseline |
| 7 | Blood panel — **eGFR 46** | May 2026 | "worse than March?" — Ask cites both |
| 8 | Cardiology letter — **Ramipril → 5mg**, kidney caution, refers nephrology | 12 May 2026 | the what-changed star |
| 9 | Nephrology referral — **goes silent** | May 2026 | overdue watch-card + chase draft |
| 10 | Diabetic eye screening appointment | Jun 2026 | appointments · Today |
| 11 | Voice note — "bloods in 6 weeks, watch the ankle swelling" | Jun 2026 | voice pipeline → loop |
| 12 | Medicine-box photo — Atorvastatin, slightly blurry | Jul 2026 | box ingest · one amber fact |
| 12b | Duplicate photo of #8 | — | merge prompt fixture |

Final med list: Ramipril 5mg · Bisoprolol 2.5mg · Furosemide 40mg · Metformin 1g bd · Atorvastatin 20mg · GTN patch 5mg daily (rotating). Allergy: penicillin. Emergency contact: Amira. DNR: set manually.

## 11. Stretch lane (build ONLY on the words "start stretch")

- **Voice:** ElevenLabs agent → tool-calls to the Ask API, scoped to one person; web widget as dev stepping-stone; **Twilio number is the demo surface** (caller-ID allowlist binds Dad's number to Dad's record). **The Stage-0 Twilio/ElevenLabs spike is MANDATORY** (C4: live call decided); record the backup clip once working.
- **Guardian full board:** everything-in-flight screen with expected timelines seeded from NHS standards. (Watch-cards + drafted chase are already CORE — §4/§10.)

## 12. Build order — done-when per task (cut line: the demo works end-to-end after Stage 4)

**Stage 0 (pre-hackathon)** · 0.1 Generate dataset §10 + fixtures — *done when files exist and fixtures validate against the extraction schema* · 0.2 Twilio spike: SMS sends + (voice sandbox) test call answers — *done when both succeed* · 0.3 Supabase schema + RLS — *done when migrations apply clean and RLS tests pass for owner/patient/anon*.
**Stage 1 Record** · 1.1 Shell: tabs, switcher, onboarding, magic-link, invite — *done when Amira creates Dad and Dad joins on a second device* · 1.2 Upload → storage → document row + processing card · 1.3 Stage A transcripts for all fixtures · 1.4 Stage B extraction matches expected-facts for all 12 docs · 1.5 Live narration shows real counts · 1.6 Timeline: month headers, 6 card variants, detail sheet, view original, Fix this — *done when 12 docs render at 375px and a correction survives reload with its edited mark* · 1.7 Merge prompt on 12b — *done when merge leaves one document, two photos*.
**Stage 2 Brain** · 2.1 Ask API: cited answers, law in system prompt, not-in-record honesty, amber caveats — *done when the kidneys question cites docs 6/7/8 and an absent topic gets the honest answer* · 2.2 Ask tab UI with chips + GP-questions card + safety line · 2.3 "What this letter says" translation on detail sheet — *done when doc 8 translates*.
**Stage 3 Routines** · 3.1 Auto-schedules, editable — *done when Dad's meds produce a sensible default and an edit sticks* · 3.2 Today view + taken + due-now · 3.3 SMS reminders both phones (+email fallback) — *done when scheduled texts arrive on two real phones* · 3.4 What-changed fires on doc 8 re-ingest, card + SMS citing the letter · 3.5 Body-map logs sites, shows next — *done when patch events rotate correctly*.
**Stage 4 Capsules** · 4.1 Create/manage: 3 presets, preview, expiry defaults, revoke, view log · 4.2 Public clinical page ×3 — *done when the doctor brief reads complete in incognito on a stranger's phone, paramedic renders from lock-screen QR, family shows only meds+appointments* · 4.3 QR + wallet PDF print · 4.4 Watch-cards + "Chase this?" draft — *done when doc 9 shows overdue and opens a filled letter*.
**Stretch** · S.1 widget → S.2 Twilio number + caller binding → S.3 backup clip recorded → S.4 Guardian board.

**Runbook requirement:** exact-clicks script for the 150s demo, both demo phones prepped (PWA installed, SMS numbers verified), incognito second phone, backup clip on the desktop, one rehearsal timed.

*End of spec. Zero open questions. Build.*
