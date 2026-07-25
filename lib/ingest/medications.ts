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
 * A letter can name a medicine without prescribing one — "continue his usual
 * metformin", "dose not stated", "as before". That is a mention, not a dose,
 * and treating it as one is how a live record loses a real strength: the M3
 * ingest turned "1 g twice daily" into "Dose not stated" and then into "1g
 * tablets", inventing two dose changes on the way.
 */
const NON_DOSE_RE =
  /^(dose\s+)?(not\s+(stated|specified|given|recorded)|unstated|unknown|unchanged|as\s+(before|previous(ly)?|per\s+repeat)|continue[sd]?|ongoing|usual|n\/?a|-|—)\.?$/i

/** The extractor also writes it as a phrase: "unchanged - dose not stated". */
const NON_DOSE_PHRASE_RE = /\b(dose\s+)?not\s+(stated|specified|given|recorded)\b/i

export function statesADose(dose: string | null | undefined): boolean {
  const s = (dose ?? '').trim()
  if (!s) return false
  // Only placeholders are excluded. "One at night" and "as directed" are real
  // instructions with no number in them, and treating anything without a digit
  // as absent would quietly discard them.
  return !NON_DOSE_RE.test(s) && !NON_DOSE_PHRASE_RE.test(s)
}

/**
 * Did the dose actually change? Only a movement in strength counts.
 * A restatement in different words does not, and a document that states no
 * dose at all changes nothing.
 */
export function doseChanged(previous: string | null | undefined, next: string | null | undefined): boolean {
  if (!statesADose(next)) return false
  if (!statesADose(previous)) return true

  const a = doseStrength(previous)
  const b = doseStrength(next)
  if (a !== null && b !== null) return a !== b
  // No parseable strength on one side — compare collapsed text as a fallback.
  const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  return norm(previous) !== norm(next)
}

const FREQUENCY_RE =
  /\b(once|twice|three|four|times|daily|day|nightly|night|morning|evening|bd|od|tds|qds|nocte|mane|prn|hourly|weekly|patch(es)?\s+(daily|each))\b/i

/** Dispensing detail, not a prescription: "quantity 28", "28 tablets". */
const DISPENSING_RE = /\b(quantity|qty|pack|x\s*\d+)\b/i

/**
 * How useful a wording is to someone holding the box (SPEC-FINAL §8: the card
 * says "5mg once daily", never "5mg tablets, quantity 28").
 *
 * Longer is not better. A pharmacy repeat slip's line is longer than a clinic
 * letter's and says less about when to take it — the M3 ingest ended with every
 * dose reading "quantity 28" because the slip was simply the last one in.
 */
function doseQuality(dose: string): number {
  let score = 0
  if (FREQUENCY_RE.test(dose)) score += 4
  if (doseStrength(dose) !== null) score += 2
  if (DISPENSING_RE.test(dose)) score -= 3
  return score
}

/**
 * When the strength is unchanged, keep whichever wording is more informative.
 * A clinic letter's "5mg once daily" beats a repeat slip's "5mg".
 */
export function richerDose(previous: string, next: string): string {
  // A mention never replaces a prescription.
  if (!statesADose(next)) return previous
  if (!statesADose(previous)) return next
  if (doseChanged(previous, next)) return next

  const a = doseQuality(previous)
  const b = doseQuality(next)
  if (a !== b) return b > a ? next : previous
  return next.trim().length > previous.trim().length ? next : previous
}
