# DATA-SHAPES.md — the domain expert's curation guide
*CONTRACT: frozen 2026-07-25. This is the complete guide for curating HealthcareHelper's demo dataset. It is written to be worked from directly, daytime sessions, no developer needed. Everything the app ingests is one of the shapes below; every curated document comes with a small "expected facts" file the developers use as their test key.*

## 1. The mission

Produce the **"Dad" dataset** — the fictional patient whose story the whole demo tells — plus **coverage of every data shape** the app must survive. Dad: heart failure + type 2 diabetes + chronic kidney disease, managed by his daughter Amira from another city.

**Golden rules**
1. **Fictional, always.** Invented names, invented clinicians, invented practices/trusts. NHS numbers only in the format `999 xxx xxxx` (the official test range). No real addresses, no real phone numbers (use 07700 900xxx — the reserved fictional range).
2. **NHS-real in look and voice.** Letterheads, clinic codes, "Dear Dr Patel", cc lines, the slightly formal register of real clinic letters. Credibility of the demo depends on this.
3. **UK clinical conventions.** eGFR in mL/min/1.73m² · HbA1c in mmol/mol · doses like "5mg once daily" · dates like 12 May 2026.
4. Every document does a job — it exists to prove a feature (column 4 below). If a document proves nothing, it's not needed.

## 2. The priority list — Dad's 13 documents (curate FIRST, in this order)

| # | Document | Date | Must contain / prove |
|---|---|---|---|
| 1 | GP referral letter → cardiology | Jan 2026 | opens a referral loop |
| 2 | Cardiology clinic letter | Feb 2026 | HF diagnosis; **starts Ramipril 2.5mg + Bisoprolol 2.5mg**; sentence "we will write to you within 3 weeks" (→ loop with expected date) |
| 3 | Echo report | Feb 2026 | a result with values + units (e.g. LVEF %) |
| 4 | Discharge summary, 3-day admission | Mar 2026 | **adds Furosemide 40mg**; med list restated; heavy-month test |
| 5 | GP medication review | Apr 2026 | full med list incl. **GTN patch 5mg daily** with note to rotate sites (hips/upper arms); **penicillin allergy** |
| 6 | Blood panel | Mar 2026 | **eGFR 52**, HbA1c value — trend baseline |
| 7 | Blood panel | May 2026 | **eGFR 46** — the "worse than March?" answer |
| 8 | Cardiology letter | **12 May 2026** | **Ramipril increased 2.5mg → 5mg**; kidney caution; "referring to nephrology" — the star document |
| 9 | Nephrology referral confirmation | May 2026 | a referral that then goes SILENT (nothing later references it) |
| 10 | Diabetic eye screening appointment letter | Jun 2026 | an extractable date/time/location |
| 11 | Voice-note script (30s, written to be recorded) | Jun 2026 | Amira: "GP wants bloods again in 6 weeks, and to watch the ankle swelling" — loop + event |
| 12 | Medicine-box photo — Atorvastatin 20mg | Jul 2026 | photograph the (prop) box **slightly blurry on purpose** → one amber "unconfirmed" fact |
| 12b | Second photo of letter #8 (different angle/lighting) | — | duplicate detection |

**Dad's end-state med list (the letters must add up to exactly this):** Ramipril 5mg · Bisoprolol 2.5mg · Furosemide 40mg · Metformin 1g twice daily · Atorvastatin 20mg · GTN patch 5mg daily (rotating hips/upper arms). Allergy: penicillin. Emergency contact: Amira. DNR: none in documents (set manually in-app).

## 3. Shape coverage — "all possible data shapes" (curate AFTER the 13, one specimen each)

Documents: ☐ clinic letter (multi-paragraph) ☐ discharge summary (structured headings) ☐ GP medication review (list-style) ☐ blood panel (tabular values) ☐ imaging/echo report ☐ referral letter ☐ appointment letter ☐ screening invite ☐ multi-page letter (2–3 pages) ☐ letter containing a table ☐ handwritten addition on a typed letter (amber case) ☐ poor photo: skew/shadow/blur (amber case) ☐ medicine-box label ☐ pharmacy repeat slip ☐ voice-note transcript ☐ letter with BP reading in prose ("BP today 152/88").
Facts: ☐ med started ☐ med stopped ☐ dose changed ☐ patch/gel with site instruction ☐ allergy with reaction ☐ numeric result with range ☐ text result ("no acute changes") ☐ each loop type: referral / test / promised letter / follow-up.

## 4. The expected-facts file (one per document — this is the developers' test key)

Save as `demo-data/fixtures/NN.json` next to `demo-data/docs/NN-short-name.pdf|jpg`. Fill only what the document truly contains. `expected_confidence`: `high` = a careful reader is certain; `low` = genuinely ambiguous in the artefact (blurry, handwritten) — these are the amber cases.

```json
{
  "doc_meta": { "type": "clinic_letter", "date": "2026-05-12", "sender": "Cardiology, St Saviour's NHS Trust (fictional)", "human_title": "Heart clinic letter" },
  "transcript_must_include": ["Ramipril", "5 mg", "nephrology"],
  "conditions":  [ { "name": "Heart failure with reduced ejection fraction", "status": "active", "expected_confidence": "high" } ],
  "medications": [ { "name": "Ramipril", "dose": "5mg once daily", "form": "tablet",
                     "change": { "old_dose": "2.5mg once daily" }, "expected_confidence": "high" } ],
  "allergies":   [ { "substance": "penicillin", "reaction": "rash", "expected_confidence": "high" } ],
  "results":     [ { "name": "eGFR", "value": 46, "unit": "mL/min/1.73m²", "ref_low": 90, "ref_high": null,
                     "date": "2026-05-10", "flagged_by_letter": true, "expected_confidence": "high" } ],
  "appointments": [ { "title": "Nephrology clinic", "location": "St Saviour's", "starts_at": null, "expected_confidence": "high" } ],
  "open_loops":  [ { "type": "referral", "description": "Referred to nephrology", "expected_date": "2026-06-23", "expected_confidence": "high" } ]
}
```

Omit any empty section. The build's extraction tests pass when the pipeline's output matches these files (names fuzzy-matched, numbers exact, `low` items must come out amber).

## 5. Workflow & handoff

- Work in `demo-data/docs/` + `demo-data/fixtures/` (numbered names as above). If git is unfriendly, a shared folder is fine — Dev A syncs it into the repo each evening.
- Make letters as Word/Google Docs → export PDF; "photographed" versions = print-and-photo or a photo of the screen at slight angle (that realism is a feature). One letter should exist as BOTH clean PDF and photo.
- Daily rhythm: curate in the daytime → drop files in → overnight/evening the devs run the pipeline against them → a short list of mismatches comes back ("the pipeline read 5mg as 5mcg — is the artefact ambiguous or is the pipeline wrong?") → fix whichever is at fault. That loop IS the QA of the product's core magic.
- **Done when:** all 13 priority docs + fixtures in place and passing · shape checklist each has one specimen · every SPEC-FINAL §0 demo beat has its prop · a final read-through confirms no real-world identifying details anywhere.
