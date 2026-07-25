import type { ExtractedFacts } from '@/lib/ingest/schema'
import { CONFIRMED_THRESHOLD } from '@/lib/constants'
import { doseStrength, sameMedicine } from '@/lib/ingest/medications'
import { normaliseUnit, type Fixture } from './fixture'

/**
 * Compares pipeline output against the curator's expected-facts file.
 *
 * DATA-SHAPES §4: "names fuzzy-matched, numbers exact, low items must come out
 * amber". Names really do vary — the pipeline reads "eGFR (CKD-EPI)" where the
 * fixture says "eGFR" — so name matching is deliberately loose while every
 * number is compared exactly.
 */

export interface Mismatch {
  section: string
  expected: string
  found: string
}

export interface DocComparison {
  id: string
  transcriptMisses: string[]
  mismatches: Mismatch[]
  extras: string[]
  checked: number
  passed: boolean
}

const norm = (s: string) =>
  (s ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9.\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Loose name equality: identical, one contains the other, or strong token overlap. */
export function fuzzyName(a: string, b: string): boolean {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return false
  if (x === y || x.includes(y) || y.includes(x)) return true
  const tx = new Set(x.split(' ').filter((t) => t.length > 2))
  const ty = new Set(y.split(' ').filter((t) => t.length > 2))
  if (!tx.size || !ty.size) return false
  let shared = 0
  for (const t of tx) if (ty.has(t)) shared++
  return shared / Math.min(tx.size, ty.size) >= 0.6
}

/**
 * Appointment titles are prose, not labels: the fixture says "Cardiology
 * follow-up" where the letter yields "Cardiology outpatient review with Dr
 * Vasquez-Okafor". Comparing raw tokens drowns the one word that identifies
 * it, so strip the boilerplate and match on what is left — usually the
 * specialty. Kept separate from fuzzyName because loosening THAT would start
 * matching "Serum creatinine" to "Serum sodium".
 */
const TITLE_NOISE = new Set([
  'clinic',
  'appointment',
  'appointments',
  'review',
  'outpatient',
  'outpatients',
  'follow',
  'up',
  'followup',
  'with',
  'dr',
  'mr',
  'ms',
  'department',
  'service',
  'team',
  'the',
  'and',
  'for',
  'at',
  'in',
  'a',
  'an',
])

export function fuzzyTitle(a: string, b: string): boolean {
  const distinctive = (s: string) =>
    new Set(
      norm(s)
        .split(/[\s-]+/)
        .filter((t) => t.length > 2 && !TITLE_NOISE.has(t))
    )
  const tx = distinctive(a)
  const ty = distinctive(b)
  if (!tx.size || !ty.size) return fuzzyName(a, b)
  let shared = 0
  for (const t of tx) if (ty.has(t)) shared++
  return shared / Math.min(tx.size, ty.size) >= 0.5
}

const bandOf = (confidence: number) => (confidence >= CONFIRMED_THRESHOLD ? 'high' : 'low')

export function compareDocument(
  id: string,
  fixture: Fixture,
  transcript: string,
  facts: ExtractedFacts
): DocComparison {
  const mismatches: Mismatch[] = []
  const extras: string[] = []
  let checked = 0

  // ---- transcript assertions
  const flatTranscript = transcript.toLowerCase().replace(/\s+/g, ' ')
  const transcriptMisses = (fixture.transcript_must_include ?? []).filter(
    (m) => !flatTranscript.includes(m.toLowerCase().replace(/\s+/g, ' ').trim())
  )

  const check = (
    section: string,
    expectedList: { label: string; band: string; find: () => { ok: boolean; found: string } }[],
    foundCount: number
  ) => {
    for (const e of expectedList) {
      checked++
      const { ok, found } = e.find()
      if (!ok) mismatches.push({ section, expected: e.label, found })
    }
    const extra = foundCount - expectedList.length
    if (extra > 0) extras.push(`${section}: +${extra} beyond the fixture`)
  }

  // ---- conditions
  check(
    'conditions',
    (fixture.conditions ?? []).map((c) => ({
      label: c.name,
      band: c.expected_confidence,
      find: () => {
        const hit = facts.conditions.find((f) => fuzzyName(f.name, c.name))
        if (!hit) return { ok: false, found: 'not extracted' }
        const band = bandOf(hit.confidence)
        return band === c.expected_confidence
          ? { ok: true, found: hit.name }
          : { ok: false, found: `${hit.name} came out ${band} (${hit.confidence}), expected ${c.expected_confidence}` }
      },
    })),
    facts.conditions.length
  )

  // ---- medications: name fuzzy, STRENGTH exact
  check(
    'medications',
    (fixture.medications ?? []).map((m) => ({
      label: `${m.name} ${m.dose ?? ''}`.trim(),
      band: m.expected_confidence,
      find: () => {
        const candidates = facts.medications.filter((f) => sameMedicine(f.name, m.name))
        if (!candidates.length) return { ok: false, found: 'not extracted' }
        const wantStrength = doseStrength(m.dose)
        const hit =
          candidates.find((f) => !wantStrength || doseStrength(f.current_dose) === wantStrength) ??
          candidates[0]
        const gotStrength = doseStrength(hit.current_dose)
        if (wantStrength && gotStrength !== wantStrength) {
          return { ok: false, found: `${hit.name} ${hit.current_dose} (strength ${gotStrength ?? '?'}, expected ${wantStrength})` }
        }
        const band = bandOf(hit.confidence)
        if (band !== m.expected_confidence) {
          return { ok: false, found: `${hit.name} came out ${band} (${hit.confidence}), expected ${m.expected_confidence}` }
        }
        if (m.stopped && hit.is_active) {
          return { ok: false, found: `${hit.name} should be recorded as stopped` }
        }
        return { ok: true, found: `${hit.name} ${hit.current_dose}` }
      },
    })),
    facts.medications.length
  )

  // ---- allergies
  check(
    'allergies',
    (fixture.allergies ?? []).map((a) => ({
      label: a.substance,
      band: a.expected_confidence,
      find: () => {
        const hit = facts.allergies.find((f) => fuzzyName(f.substance, a.substance))
        return hit ? { ok: true, found: hit.substance } : { ok: false, found: 'not extracted' }
      },
    })),
    facts.allergies.length
  )

  // ---- results: name fuzzy, VALUE and UNIT exact (unit normalised for glyphs)
  check(
    'results',
    (fixture.results ?? []).map((r) => ({
      label: `${r.name} = ${r.value ?? r.value_text}${r.unit ? ' ' + r.unit : ''}`,
      band: r.expected_confidence,
      find: () => {
        // A text finding can be split either way round: the fixture says
        // "Mitral regurgitation = Mild", the report yields "Mitral valve =
        // Mild regurgitation". Same fact. Fall back to comparing name and
        // value together so an equivalent decomposition still matches.
        const whole = (name: string, v: unknown) => `${name} ${v ?? ''}`.trim()
        const hit =
          facts.results.find((f) => fuzzyName(f.name, r.name)) ??
          facts.results.find((f) =>
            fuzzyName(whole(f.name, f.value_text), whole(r.name, r.value_text))
          )
        if (!hit) return { ok: false, found: 'not extracted' }
        if (r.value !== undefined && r.value !== null) {
          if (hit.value !== r.value) return { ok: false, found: `${hit.name} = ${hit.value}, expected ${r.value}` }
        } else if (r.value_text) {
          const got = hit.value_text ?? String(hit.value ?? '')
          if (!fuzzyName(got, r.value_text)) {
            return { ok: false, found: `${hit.name} = "${got}", expected "${r.value_text}"` }
          }
        }
        if (r.unit && normaliseUnit(hit.unit) !== normaliseUnit(r.unit)) {
          return { ok: false, found: `${hit.name} unit "${hit.unit}", expected "${r.unit}"` }
        }
        return { ok: true, found: `${hit.name} = ${hit.value ?? hit.value_text}` }
      },
    })),
    facts.results.length
  )

  // ---- appointments
  check(
    'appointments',
    (fixture.appointments ?? []).map((a) => ({
      label: a.title,
      band: a.expected_confidence,
      find: () => {
        const hit = facts.appointments.find((f) => fuzzyTitle(f.title, a.title))
        if (!hit) return { ok: false, found: 'not extracted' }
        if (a.starts_at) {
          const want = a.starts_at.slice(0, 16)
          const got = (hit.starts_at ?? '').slice(0, 16)
          // Compare to the minute; timezone suffixes vary harmlessly.
          if (want.slice(0, 10) !== got.slice(0, 10)) {
            return { ok: false, found: `${hit.title} starts ${hit.starts_at}, expected ${a.starts_at}` }
          }
        }
        return { ok: true, found: hit.title }
      },
    })),
    facts.appointments.length
  )

  // ---- open loops: type must match; expected_date exact when the fixture states one
  check(
    'open_loops',
    (fixture.open_loops ?? []).map((l) => ({
      label: `${l.type}${l.expected_date ? ` by ${l.expected_date}` : ''}: ${l.description.slice(0, 48)}`,
      band: l.expected_confidence,
      find: () => {
        const sameType = facts.open_loops.filter((f) => f.loop_type === l.type)
        if (!sameType.length) return { ok: false, found: `no ${l.type} loop extracted` }
        const byDate = l.expected_date
          ? sameType.filter((f) => f.expected_date === l.expected_date)
          : sameType
        if (l.expected_date && !byDate.length) {
          return {
            ok: false,
            found: `${l.type} loops found but none due ${l.expected_date} (got ${sameType.map((f) => f.expected_date ?? 'null').join(', ')})`,
          }
        }
        const hit = byDate[0]
        const band = bandOf(hit.confidence)
        if (band !== l.expected_confidence) {
          return { ok: false, found: `came out ${band} (${hit.confidence}), expected ${l.expected_confidence}` }
        }
        return { ok: true, found: hit.description.slice(0, 48) }
      },
    })),
    facts.open_loops.length
  )

  return {
    id,
    transcriptMisses,
    mismatches,
    extras,
    checked,
    passed: transcriptMisses.length === 0 && mismatches.length === 0,
  }
}
