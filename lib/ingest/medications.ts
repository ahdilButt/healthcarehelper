/**
 * Medication identity and dose comparison.
 *
 * Two documents describe the same medicine very differently. A cardiology
 * letter says "Glyceryl trinitrate (GTN) patch 5mg / 24 hours, one patch
 * daily"; the pharmacy slip says "GTN 5mg patches". Naive string equality
 * creates a duplicate row for each phrasing, and — far worse — reads the
 * terser restatement "Ramipril 5mg" against the stored "Ramipril 5mg once
 * daily" as a DOSE CHANGE, firing a what-changed alert that never happened.
 *
 * So: identity is keyed on the drug name with strengths, forms and frequencies
 * stripped, and a dose change means the STRENGTH moved, not the wording.
 */

const FORM_WORDS = [
  'tablet',
  'tablets',
  'capsule',
  'capsules',
  'patch',
  'patches',
  'gel',
  'injection',
  'injections',
  'inhaler',
  'liquid',
  'solution',
  'suspension',
  'film-coated',
  'modified-release',
  'mr',
  'sr',
]

const FREQ_WORDS = [
  'once',
  'twice',
  'three',
  'four',
  'times',
  'daily',
  'day',
  'nightly',
  'night',
  'morning',
  'evening',
  'bd',
  'od',
  'tds',
  'qds',
  'nocte',
  'mane',
  'prn',
  'each',
  'every',
  'per',
  'a',
  'at',
  'in',
  'the',
  'hours',
  'hour',
  'hrs',
]

const STRENGTH_RE = /(\d+(?:\.\d+)?)\s*(mcg|microgram|micrograms|mg|g|ml|units?)\b/gi

/**
 * A stable identity key for a medicine name.
 * "Glyceryl trinitrate (GTN) patch 5mg / 24 hours" -> "glyceryl trinitrate"
 */
export function medKey(name: string): string {
  let s = name.toLowerCase()
  s = s.replace(/\([^)]*\)/g, ' ') // drop "(GTN)", "(2 x 40mg)"
  s = s.replace(STRENGTH_RE, ' ')
  s = s.replace(/\/\s*\d+\s*(hours?|h)\b/g, ' ') // "/ 24 hours"
  s = s.replace(/[^a-z\s-]/g, ' ')
  const words = s
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !FORM_WORDS.includes(w) && !FREQ_WORDS.includes(w))
  return words.join(' ').trim()
}

/** Two names refer to the same medicine when their keys match, or one contains the other. */
export function sameMedicine(a: string, b: string): boolean {
  const ka = medKey(a)
  const kb = medKey(b)
  if (!ka || !kb) return false
  if (ka === kb) return true
  // "glyceryl trinitrate" vs "glyceryl trinitrate gtn" — one is a prefix of the other.
  return ka.startsWith(kb) || kb.startsWith(ka)
}

/**
 * The strength a dose string prescribes, normalised.
 * "5mg once daily" -> "5mg" · "1 g twice daily" -> "1g" · "2.5 mg" -> "2.5mg"
 * Returns null when no strength is stated, in which case callers fall back to
 * comparing the raw text.
 */
export function doseStrength(dose: string | null | undefined): string | null {
  if (!dose) return null
  const matches = [...dose.matchAll(STRENGTH_RE)]
  if (!matches.length) return null
  // The first strength is the prescribed one; later ones are usually a
  // parenthetical breakdown ("80mg each morning (2 x 40mg)").
  const [, num, unit] = matches[0]
  const u = unit.toLowerCase().replace(/^micrograms?$/, 'mcg').replace(/^units$/, 'unit')
  return `${parseFloat(num)}${u}`
}

/**
 * Did the dose actually change? Only a movement in strength counts.
 * A restatement in different words does not.
 */
export function doseChanged(previous: string | null | undefined, next: string | null | undefined): boolean {
  const a = doseStrength(previous)
  const b = doseStrength(next)
  if (a !== null && b !== null) return a !== b
  // No parseable strength on one side — compare collapsed text as a fallback.
  const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  return norm(previous) !== norm(next)
}

/**
 * When the strength is unchanged, keep whichever wording is more informative.
 * A clinic letter's "5mg once daily" beats a repeat slip's "5mg".
 */
export function richerDose(previous: string, next: string): string {
  if (doseChanged(previous, next)) return next
  return next.trim().length > previous.trim().length ? next : previous
}
