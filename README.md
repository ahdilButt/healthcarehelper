# Demo data fixtures

One JSON file per document, `doc-01.json` ... `doc-12.json`, plus `persons.json`
for the two profiles (Amira = owner/self, Dad = managed profile). Run `pnpm seed`
(see `../seed.mjs`) to load all of this into Supabase.

## Storyline
Dad: CKD stage 3 + hypertension, ~18 months, ending with a Ramipril dose
increase, a worsening-then-recovering picture, a new diuretic, one overdue
referral, and one overdue "will write" letter — enough for the timeline,
what-changed alert, Guardian alert, and results-explained demo beats to all
have real data behind them.

## Placeholder docs — NEEDS CURATOR CONTENT
`doc-02`, `doc-05`, `doc-07`, `doc-08` are marked `"_placeholder": true` with
a `"_note"` field explaining what to preserve. These were hand-written by
Dev A as stand-ins so `pnpm seed` works end-to-end today. When Expert C
delivers real content for these:

1. Keep the same filename (`doc-02.json` etc.) and the same `ref` values
   inside `facts` (e.g. `"ref": "ramipril"`) — other docs reference these
   by ref (see below), so renaming breaks the seed script.
2. Remove the `_placeholder` and `_note` fields once replaced.
3. Re-run `pnpm seed` — it's idempotent and safe to run repeatedly.

## How cross-document references work
Medications are introduced once (with a `ref`, e.g. `"ref": "ramipril"`) and
later dose changes reference that same `ref` in `med_change_events` via
`medication_ref`. The seed script keeps an in-memory map from ref -> real
database id as it processes files in filename order, so **doc filenames
must sort in chronological/dependency order** (doc-02 introduces Ramipril;
doc-05 changes its dose — doc-05 must run after doc-02).

## Fixture shape (per document)
```json
{
  "ref": "doc-05",
  "person_ref": "dad",
  "kind": "letter_photo | pdf | voice_note | box_photo",
  "doc_type": "free text, e.g. cardiology_letter",
  "doc_date": "YYYY-MM-DD",
  "sender": "free text or null",
  "status": "ready",
  "transcript": "full text of the letter",
  "facts": {
    "conditions": [{ "name": "...", "status": "active", "confidence": 0.95 }],
    "medications": [{ "ref": "ramipril", "name": "Ramipril", "current_dose": "5mg once daily", "form": "tablet", "confidence": 0.9 }],
    "med_change_events": [{ "medication_ref": "ramipril", "old_dose": "2.5mg once daily", "new_dose": "5mg once daily", "changed_on": "2026-05-12", "confidence": 0.9 }],
    "allergies": [{ "substance": "Penicillin", "reaction": "rash and swelling", "confidence": 0.95 }],
    "results": [{ "name": "eGFR", "value": 45, "unit": "mL/min/1.73m2", "ref_low": 90, "ref_high": 120, "flagged": true, "result_date": "2026-06-20", "confidence": 0.95 }],
    "appointments": [{ "title": "Nephrology follow-up", "location": "...", "starts_at": "2026-08-15T10:30:00+01:00", "confidence": 0.96 }],
    "open_loops": [{ "loop_type": "referral | test | letter | follow_up | other", "description": "...", "expected_date": "2026-06-15", "state": "waiting | done | overdue", "confidence": 0.9 }]
  }
}
```

All fact types are optional — a fixture only includes the ones that document
actually produced. `confidence` is required on every fact row per the schema
contract (§2): unconfirmed facts (confidence < 0.80 and no `confirmed_at`)
never surface in capsules or what-changed alerts, so keep demo fixtures at
0.85+ unless you're deliberately testing the low-confidence path.
