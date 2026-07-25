import type { ExtractedFacts } from '@/lib/ingest/schema'
import { MED_FORMS, LOOP_TYPES } from '@/lib/ingest/schema'

/**
 * The curator's expected-facts file (demo-data/fixtures/NN.json), and the
 * conversion into the one fact shape the writer understands.
 *
 * The fixture speaks in "high"/"low"; the database speaks in a 0..1 confidence.
 * Those map here, in one place, so the seed and the extraction comparator agree
 * on what "amber" means.
 */

export type ExpectedConfidence = 'high' | 'low'

export interface Fixture {
  doc_meta: { type: string; date: string; sender?: string | null; human_title: string }
  transcript_must_include?: string[]
  conditions?: { name: string; status?: string; expected_confidence: ExpectedConfidence }[]
  medications?: {
    name: string
    dose?: string
    form?: string
    schedule_hint?: string | null
    rotation_sites?: string[] | null
    stopped?: boolean
    change?: { old_dose?: string | null } | null
    expected_confidence: ExpectedConfidence
  }[]
  allergies?: { substance: string; reaction?: string | null; expected_confidence: ExpectedConfidence }[]
  results?: {
    name: string
    value?: number | null
    value_text?: string | null
    unit?: string | null
    ref_low?: number | null
    ref_high?: number | null
    date?: string | null
    flagged_by_letter?: boolean
    expected_confidence: ExpectedConfidence
  }[]
  appointments?: {
    title: string
    location?: string | null
    starts_at?: string | null
    expected_confidence: ExpectedConfidence
  }[]
  open_loops?: {
    type: string
    description: string
    expected_date?: string | null
    expected_confidence: ExpectedConfidence
  }[]
  duplicate_of?: string
  note?: string
}

/** A careful reader is certain / genuinely ambiguous, either side of CONFIRMED_THRESHOLD. */
export const CONFIDENCE_FOR: Record<ExpectedConfidence, number> = { high: 0.95, low: 0.62 }

const form = (v: string | undefined): (typeof MED_FORMS)[number] =>
  (MED_FORMS as readonly string[]).includes(v ?? '') ? (v as (typeof MED_FORMS)[number]) : 'tablet'

const loop = (v: string): (typeof LOOP_TYPES)[number] =>
  (LOOP_TYPES as readonly string[]).includes(v) ? (v as (typeof LOOP_TYPES)[number]) : 'other'

export function fixtureToFacts(fx: Fixture): ExtractedFacts {
  const c = (e: ExpectedConfidence) => CONFIDENCE_FOR[e]
  return {
    doc_meta: {
      type: fx.doc_meta.type,
      date: fx.doc_meta.date ?? null,
      sender: fx.doc_meta.sender ?? null,
      human_title: fx.doc_meta.human_title,
    },
    conditions: (fx.conditions ?? []).map((x) => ({
      name: x.name,
      status: x.status ?? 'active',
      confidence: c(x.expected_confidence),
    })),
    medications: (fx.medications ?? []).map((x) => ({
      name: x.name,
      current_dose: x.dose ?? '',
      form: form(x.form),
      schedule_hint: x.schedule_hint ?? null,
      rotation_sites: x.rotation_sites ?? null,
      is_active: x.stopped ? false : true,
      change: x.change ? { old_dose: x.change.old_dose ?? null } : null,
      confidence: c(x.expected_confidence),
    })),
    allergies: (fx.allergies ?? []).map((x) => ({
      substance: x.substance,
      reaction: x.reaction ?? null,
      confidence: c(x.expected_confidence),
    })),
    results: (fx.results ?? []).map((x) => ({
      name: x.name,
      value: x.value ?? null,
      value_text: x.value_text ?? null,
      unit: x.unit ?? null,
      ref_low: x.ref_low ?? null,
      ref_high: x.ref_high ?? null,
      flagged: x.flagged_by_letter ?? false,
      result_date: x.date ?? null,
      confidence: c(x.expected_confidence),
    })),
    appointments: (fx.appointments ?? []).map((x) => ({
      title: x.title,
      location: x.location ?? null,
      starts_at: x.starts_at ?? null,
      confidence: c(x.expected_confidence),
    })),
    open_loops: (fx.open_loops ?? []).map((x) => ({
      loop_type: loop(x.type),
      description: x.description,
      expected_date: x.expected_date ?? null,
      confidence: c(x.expected_confidence),
    })),
  }
}

/**
 * Units are compared normalised.
 *
 * pdf-lib's standard fonts are WinAnsi, so the rendered artefacts print
 * "umol/L" and "mL/min/1.73m2" where the curator wrote "µmol/L" and
 * "mL/min/1.73m²". A faithful transcript therefore contains the ASCII form and
 * a literal string comparison would fail every renal result. Normalising both
 * sides is the honest fix — the values are identical, only the glyphs differ.
 */
export function normaliseUnit(u: string | null | undefined): string {
  if (!u) return ''
  return u
    .toLowerCase()
    .replace(/µ|μ/g, 'u')
    .replace(/²/g, '2')
    .replace(/\s+/g, '')
    .replace(/\/1\.73m2$/, '/1.73m2')
}
