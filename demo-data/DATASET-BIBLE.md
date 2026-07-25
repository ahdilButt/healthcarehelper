# DATASET-BIBLE.md — the single source of truth for "Dad's" fictional record

*Status: **DRAFT** (generated 2026-07-25 by the works-lane, per CLAUDE.md AUTOPILOT step 0). The domain expert corrects this later; every artefact generated from it is marked DRAFT in its footer.*

**Every artefact and every fixture MUST agree with this file exactly.** Names, dates, numbers, doses and reference ranges are canonical here. If a document needs a fact that is not in this file, it must not invent one — it either omits it or uses a value listed below.

---

## 1. Identities (all fictional)

| Role | Name | Detail |
|---|---|---|
| The patient ("Dad") | **Mr Samuel Adeyemi** | DOB **14 March 1952**. NHS no. **999 471 3382** (official test range). |
| The daughter / carer | **Ms Amira Adeyemi** | Manages his care from another city. Mobile **07700 900412**. Emergency contact. |
| GP | **Dr Priya Raman**, MBBS MRCGP | Marlow Fields Medical Centre |
| Consultant cardiologist | **Dr Helena Vasquez-Okafor**, MBBS MD FRCP | Cardiology, St Saviour's |
| Cardiology registrar | **Dr Tomas Lindqvist**, ST6 | Co-signs doc 4 |
| Consultant nephrologist | **Dr Marcus Oyelaran**, MBBS FRCP | Named on the referral that goes silent |
| Cardiac physiologist | **Ms Fenella Achebe**, BSc | Performs the echo |
| Practice pharmacist | **Mr Declan Whitmore**, MPharm | Medication review co-author |
| Screening admin | **Ashcombe Community Screening Hub** | — |

**Addresses (all fictional; postcodes use the reserved ZZ99 range)**

- Patient home: `12 Wreneley Gardens, Ashcombe Vale, ZZ99 3CZ`
- St Saviour's NHS Foundation Trust: `St Saviour's Hospital, Carradine Way, Ashcombe, ZZ99 1SS` · Tel `01632 960118`
- Marlow Fields Medical Centre: `Marlow Fields Medical Centre, 3 Pinner Row, Ashcombe Vale, ZZ99 3DF` · Tel `01632 960477`
- Ashcombe Community Screening Hub: `Unit 4, Halberd Court, Ashcombe, ZZ99 2HQ` · Tel `01632 960903`
- Pinner Row Pharmacy: `5 Pinner Row, Ashcombe Vale, ZZ99 3DF` · Tel `01632 960512`

**Phone-number law:** mobiles only from `07700 900000–900999`; landlines only from `01632 960000–960999`. Both are the official UK reserved fictional ranges. No other numbers may appear.

---

## 2. Conditions

| Condition | Status | Diagnosed | First appears |
|---|---|---|---|
| Type 2 diabetes mellitus | active | 2015 | doc 1 (as history) |
| Hypertension | active | 2011 | doc 1 (as history) |
| **Heart failure with reduced ejection fraction (HFrEF)** | active | **11 Feb 2026** | doc 2 (the diagnosis) |
| **Chronic kidney disease, stage 3a** | active | **12 May 2026** | doc 8 (cardiology names it) |

## 3. Allergy

**Penicillin** — reaction: *widespread rash and facial swelling*, first recorded 1998. Stated in full only in doc 5. May be referenced in passing on doc 4's discharge summary allergy box.

## 4. Medication timeline (the letters must add up to exactly this)

| Medicine | Dose | Form | Started | Changed | Source doc |
|---|---|---|---|---|---|
| Metformin | 1 g twice daily | tablet | 2015 (pre-existing) | — | doc 1 |
| Amlodipine | 5 mg once daily | tablet | 2011 (pre-existing) | **STOPPED 11 Feb 2026** | doc 1 → stopped in doc 2 |
| **Ramipril** | 2.5 mg once daily → **5 mg once daily** | tablet | 11 Feb 2026 | **increased 12 May 2026** | doc 2, changed in doc 8 |
| **Bisoprolol** | 2.5 mg once daily | tablet | 11 Feb 2026 | — | doc 2 |
| **Furosemide** | 40 mg once daily (morning) | tablet | 6 Mar 2026 (on discharge) | — | doc 4 |
| **GTN patch (glyceryl trinitrate)** | 5 mg / 24 h, one patch daily | patch | 21 Apr 2026 | — | doc 5 |
| **Atorvastatin** | 20 mg once daily (at night) | tablet | long-standing repeat | — | **doc 12 only (the box photo)** |

**Deliberate gap — do not "fix" it:** Atorvastatin appears in **no letter**. It is a long-standing repeat that the correspondence never enumerates, which is precisely why the family has to photograph the box (doc 12). Doc 4 says "continue usual repeat medications"; doc 5 says items not reviewed remain unchanged on repeat. Both are realistic and both preserve the gap.

**GTN patch site rotation (doc 5, verbatim intent):** apply one patch each morning, remove at night for a nitrate-free interval, and **rotate the site — left hip, right hip, left upper arm, right upper arm** — to avoid skin irritation.

**End-state list (must be exactly this after all 15 documents):** Ramipril 5 mg · Bisoprolol 2.5 mg · Furosemide 40 mg · Metformin 1 g bd · Atorvastatin 20 mg · GTN patch 5 mg daily. Amlodipine is stopped. Allergy: penicillin.

## 5. Results — canonical values (UK units)

**Bloods taken 16 Mar 2026, reported 18 Mar 2026 (doc 6)**

| Test | Value | Unit | Ref range |
|---|---|---|---|
| eGFR | **52** | mL/min/1.73m² | > 90 |
| Creatinine | 118 | µmol/L | 59–104 |
| Sodium | 139 | mmol/L | 133–146 |
| Potassium | 4.6 | mmol/L | 3.5–5.3 |
| HbA1c | **58** | mmol/mol | 20–41 |
| Haemoglobin | 129 | g/L | 130–170 |

**Bloods taken 10 May 2026, reported 14 May 2026 (doc 7)**

| Test | Value | Unit | Ref range |
|---|---|---|---|
| eGFR | **46** | mL/min/1.73m² | > 90 |
| Creatinine | 131 | µmol/L | 59–104 |
| Sodium | 137 | mmol/L | 133–146 |
| Potassium | 5.1 | mmol/L | 3.5–5.3 |
| HbA1c | **61** | mmol/mol | 20–41 |

**Echocardiogram, performed 10 Feb 2026, reported 13 Feb 2026 (doc 3)**

| Measure | Value | Unit | Note |
|---|---|---|---|
| LVEF (Simpson's biplane) | **38** | % | moderately impaired (normal > 55) |
| LV internal diameter, diastole | 58 | mm | mildly dilated |
| Mitral regurgitation | — | — | text result: "mild" |
| Aortic valve | — | — | text result: "trileaflet, no stenosis" |
| Overall conclusion | — | — | text result: "Moderate left ventricular systolic dysfunction." |

**Blood pressure in prose (doc 5):** "BP today 152/88" — this is a prose reading, not a table row.

**Chest X-ray on admission (doc 4, text result):** "Mild pulmonary congestion. No consolidation."

**Weight (doc 4):** on admission 91.4 kg, on discharge 87.8 kg.

## 6. The open loops (what the app must find)

| # | Type | Description | Opened by | Expected date | Fate |
|---|---|---|---|---|---|
| L1 | referral | GP refers to cardiology; "seen within six weeks" | doc 1 (8 Jan) | 2026-02-19 | closed by doc 2 |
| L2 | letter | "We will write again within three weeks with the echocardiogram report" | doc 2 (11 Feb) | 2026-03-04 | closed by doc 3 |
| L3 | test | Repeat U&E in two weeks after the Ramipril increase | doc 8 (12 May) | 2026-05-26 | never closed (secondary) |
| L4 | **referral** | **Referred to nephrology; renal team aim to see within six weeks** | **doc 8 (12 May)** | **2026-06-23** | **GOES SILENT — the demo's watch-card** |
| L5 | test | Repeat bloods in six weeks | doc 11 voice note (22 Jun) | 2026-08-03 | open at demo time |
| L6 | follow_up | Watch the ankle swelling; ring if weight rises > 2 kg in three days | doc 11 voice note (22 Jun) | *(none)* | open at demo time |

Doc 9 acknowledges L4 but sets no appointment. **Nothing after doc 9 mentions nephrology.** That silence is the point — do not reference nephrology in docs 10, 11, 12, S1 or S2.

**This table is not exhaustive.** It names the loops the demo beats depend on. Documents legitimately open other loops (doc 4's post-discharge U&E check, doc 5's repeat bloods, S1's screening-kit return, S2's dose query) and those are correct extractions, not defects — the watch-card logic must cope with loops this table never names.

## 7. Appointments

| Appointment | When | Where | Source |
|---|---|---|---|
| Diabetic eye screening | **Tuesday 14 July 2026, 10:20** | Marlow Fields Medical Centre, Ashcombe Vale | doc 10 |
| Cardiology follow-up | **October 2026 (month only, no date given)** | Cardiology outpatients, St Saviour's | doc 8 |

## 8. The 15 artefacts

| # | Slug | Date | Kind | Job it does |
|---|---|---|---|---|
| 01 | `gp-referral-cardiology` | 2026-01-08 | letter (pdf) | opens referral loop L1 |
| 02 | `cardiology-clinic-letter-feb` | 2026-02-11 | letter (pdf) | HFrEF dx; starts Ramipril 2.5 + Bisoprolol 2.5; stops Amlodipine; opens L2 |
| 03 | `echo-report` | 2026-02-13 | report (pdf) | numeric + text results |
| 04 | `discharge-summary-march` | 2026-03-06 | discharge summary, 2 pages (pdf) | adds Furosemide; structured headings + med table; heavy month |
| 05 | `gp-medication-review` | 2026-04-21 | letter, list-style (pdf) | GTN patch + site rotation; penicillin allergy; BP in prose |
| 06 | `blood-panel-march` | 2026-03-18 | lab report, tabular (pdf) | eGFR 52 baseline |
| 07 | `blood-panel-may` | 2026-05-14 | lab report, tabular (pdf) | eGFR 46 — "worse than March?" |
| 08 | `cardiology-letter-12-may` | **2026-05-12** | letter, 2 pages (pdf) | **Ramipril 2.5 → 5 mg**; kidney caution; nephrology referral (L4) |
| 09 | `nephrology-referral-ack` | 2026-05-19 | admin letter (pdf) | acknowledges L4, then silence |
| 10 | `eye-screening-appointment` | 2026-06-08 | appointment/screening invite (pdf) | extractable date/time/place |
| 11 | `voice-note-june` | 2026-06-22 | voice note (transcript .txt) | opens L5 + L6 |
| 12 | `atorvastatin-box` | 2026-07-02 | **box photo (png, deliberately blurry)** | Atorvastatin 20 mg as ONE amber fact |
| 12b | `cardiology-letter-12-may-photo` | 2026-05-12 | **photo of doc 08 (png, skewed)** | duplicate-merge prompt |
| S1 | `bowel-screening-invite` | 2026-06-15 | screening invite (pdf) | shape coverage: screening invite |
| S2 | `pharmacy-repeat-slip` | 2026-07-06 | **repeat slip with handwritten addition (png)** | shape coverage: handwritten amber case |

## 9. House style for every artefact

- UK clinical register: "Dear Dr Raman", "Yours sincerely", "Re:", "cc:", "Diagnosis:", "Plan:".
- Dates in body text written long-form: **12 May 2026**. Never US order.
- Doses written **"5 mg once daily"** (space before unit) in prose; med tables may use "5mg".
- eGFR always in `mL/min/1.73m²`; HbA1c in `mmol/mol`; creatinine in `µmol/L`.
- Every letter carries `NHS number: 999 471 3382` and `DOB: 14 March 1952` in a Re: block.
- Every artefact footer ends with: `FICTIONAL DEMONSTRATION DOCUMENT — NOT A REAL MEDICAL RECORD — DRAFT`.
- No real trusts, no real clinicians, no real addresses, no real phone numbers.

## 10. Confidence law for fixtures

`expected_confidence` is `"high"` unless the artefact genuinely makes the fact ambiguous. Amber facts exist in **exactly two documents**:

1. **doc 12** — Atorvastatin 20 mg, read off a blurred, badly-lit box label.
2. **S2** — the "check this with the GP" loop raised by the handwritten biro annotation on the pharmacy slip.

Note what S2 deliberately does **not** contain: a second Furosemide medication row at 80 mg. An ambiguous handwritten dose query is a question for a clinician, not a dose. The pipeline records it as a loop and leaves the live dose alone — recording it as a medicine is the failure mode, so the fixture asserts the loop instead.

Everything else must extract cleanly at `high`.

**doc 12b carries no facts at all.** It is page 1 of doc 08 photographed at an angle; its fixture asserts only the strings visible on that page and exists to prove *duplicate detection*, not extraction. Copying doc 08's full fixture onto it would assert page-2 and page-3 text that the photograph cannot possibly contain.

**Why the amber cases matter beyond the demo:** an unconfirmed reading must never rewrite a live dose or fire a what-changed alert (SPEC-FINAL §3). The S2 annotation is the test of that rule — the pipeline must leave Furosemide at 40 mg and raise a question, not silently record 80 mg.
